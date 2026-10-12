import {Timestamp, collection, doc, getDocs, serverTimestamp, writeBatch} from "firebase/firestore";
import {db} from "./firebase";
import {auth} from "./auth";
import {workerRequest} from "./workerClient";
import {planCalendarSync, type CalendarSyncChanges, type ExistingSchedule,
  type SyncSummary} from "./calendarSyncPlan";
import type {ScheduleDocument} from "../types/models";

export interface CalendarOption {id: string; summary: string; primary?: boolean; accessRole?: string}
export type {SyncSummary} from "./calendarSyncPlan";

export async function connectGoogleCalendar(serverAuthCode: string): Promise<void> {
  await workerRequest("/v1/google/connect", "POST", {serverAuthCode});
}

export async function getCalendarChoices(): Promise<{
  calendars: CalendarOption[]; selectedCalendarIds: string[];
}> {
  return workerRequest("/v1/google/calendars");
}

export async function setCalendarChoices(calendarIds: string[]): Promise<void> {
  await workerRequest("/v1/google/calendars/selection", "PUT", {calendarIds});
}

export async function publishManualSchedule(
  scheduleId: string, schedule: ScheduleDocument, calendarId: string
): Promise<void> {
  const user = auth.currentUser;
  if (!user || schedule.userId !== user.uid || schedule.source !== "manual") {
    throw new Error("Hanya jadwal manual milik sendiri yang dapat dikirim.");
  }
  const result = await workerRequest<{googleEventId: string; googleCalendarId: string}>(
    "/v1/google/events/upsert", "POST", {
      appScheduleId: scheduleId, calendarId,
      idempotencyKey: `${scheduleId}:${schedule.updatedAt.toMillis()}`,
      title: schedule.title, startMs: schedule.startTime.toMillis(),
      endMs: schedule.endTime.toMillis(), timeZone: schedule.timeZone,
      recurrence: schedule.recurrence,
    }
  );
  const batch = writeBatch(db);
  batch.update(doc(db, "users", user.uid, "schedules", scheduleId), {
    googleEventId: result.googleEventId, googleCalendarId: result.googleCalendarId,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function requestCalendarSync(): Promise<SyncSummary> {
  const user = auth.currentUser;
  if (!user) throw new Error("Masuk terlebih dahulu.");
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jakarta";
  const response = await workerRequest<{
    calendars: CalendarSyncChanges[];
    windowStartMs: number; windowEndMs: number;
  }>("/v1/google/sync", "POST", {timeZone});
  const ref = collection(db, "users", user.uid, "schedules");
  const snapshot = await getDocs(ref);
  const documents = new Map(snapshot.docs.map((item) => [item.id, item.data() as ScheduleDocument]));
  const existing = new Map<string, ExistingSchedule>(
    [...documents].map(([id, item]) => [id, {
      source: item.source, status: item.status, title: item.title,
      startMs: item.startTime.toMillis(), endMs: item.endTime.toMillis(),
      googleEventId: item.googleEventId, googleCalendarId: item.googleCalendarId,
      allDay: item.allDay, timeZone: item.timeZone, recurrence: item.recurrence,
      recurringEventId: item.recurringEventId, originalStartTime: item.originalStartTime,
      etag: item.etag,
    }])
  );
  const summary: SyncSummary = {imported: 0, updated: 0, unchanged: 0, cancelled: 0};
  for (const calendar of response.calendars) {
    const planned = planCalendarSync(existing, calendar,
      response.windowStartMs, response.windowEndMs);
    for (let offset = 0; offset < planned.writes.length; offset += 400) {
      const batch = writeBatch(db);
      for (const write of planned.writes.slice(offset, offset + 400)) {
        if (write.kind === "cancel") {
          batch.update(doc(ref, write.id), {
            status: "cancelled", updatedAt: serverTimestamp(),
          });
        } else {
          const event = write.event;
          batch.set(doc(ref, write.id), {
            userId: user.uid, title: event.title,
            startTime: Timestamp.fromMillis(event.startMs),
            endTime: Timestamp.fromMillis(event.endMs),
            isMandatory: true, source: "google", status: "confirmed",
            googleEventId: event.googleEventId,
            googleCalendarId: event.googleCalendarId,
            allDay: event.allDay, timeZone: event.timeZone,
            recurrence: event.recurrence,
            recurringEventId: event.recurringEventId,
            originalStartTime: event.originalStartTime,
            etag: event.etag,
            ...(documents.has(write.id) ? {} : {createdAt: serverTimestamp()}),
            updatedAt: serverTimestamp(),
          }, {merge: true});
        }
      }
      await batch.commit();
    }
    await workerRequest("/v1/google/sync/ack", "POST", {
      calendarId: calendar.calendarId, nextSyncToken: calendar.nextSyncToken,
    });
    summary.imported += planned.summary.imported;
    summary.updated += planned.summary.updated;
    summary.unchanged += planned.summary.unchanged;
    summary.cancelled += planned.summary.cancelled;
  }
  return summary;
}
