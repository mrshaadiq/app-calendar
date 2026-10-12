import {getFirestore, Timestamp, type DocumentReference} from "firebase-admin/firestore";
import {DateTime} from "luxon";
import {
  createGoogleClient,
  createGoogleScheduleId,
  mapGoogleEvent,
} from "./calendarClient";

interface PendingWrite {
  ref: DocumentReference;
  data: Record<string, unknown>;
}

export interface SyncSummary {
  imported: number;
  updated: number;
  unchanged: number;
  cancelled: number;
}

async function commitWrites(writes: PendingWrite[]): Promise<void> {
  const db = getFirestore();
  for (let offset = 0; offset < writes.length; offset += 400) {
    const batch = db.batch();
    for (const write of writes.slice(offset, offset + 400)) {
      batch.set(write.ref, write.data, {merge: true});
    }
    await batch.commit();
  }
}

export async function syncGoogleCalendarForUser(
  userId: string,
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  timeZone: string
): Promise<SyncSummary> {
  const db = getFirestore();
  const calendarId = "primary";
  const calendar = createGoogleClient(clientId, clientSecret, refreshToken);
  const now = DateTime.now().setZone(timeZone);
  const windowStart = now.minus({days: 30}).startOf("day");
  const windowEnd = now.plus({days: 90}).endOf("day");
  const schedulesRef = db.collection("users").doc(userId).collection("schedules");
  const existingSnapshot = await schedulesRef.where("source", "==", "google").get();
  const existing = new Map(existingSnapshot.docs.map((item) => [item.id, item.data()]));
  const seen = new Set<string>();
  const writes: PendingWrite[] = [];
  const summary: SyncSummary = {imported: 0, updated: 0, unchanged: 0, cancelled: 0};
  const syncedAt = Timestamp.now();
  let pageToken: string | undefined;

  do {
    const response = await calendar.events.list({
      calendarId,
      timeMin: windowStart.toUTC().toISO()!,
      timeMax: windowEnd.toUTC().toISO()!,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 2500,
      pageToken,
    });
    const calendarTimeZone = response.data.timeZone || timeZone;

    for (const event of response.data.items || []) {
      const mapped = mapGoogleEvent(event, calendarId, calendarTimeZone);
      if (!mapped) {
        continue;
      }
      const id = createGoogleScheduleId(calendarId, mapped.googleEventId);
      seen.add(id);
      const previous = existing.get(id);
      if (previous && previous.status === "confirmed" &&
          previous.title === mapped.title &&
          previous.startTime instanceof Timestamp &&
          previous.startTime.toMillis() === mapped.startMs &&
          previous.endTime instanceof Timestamp &&
          previous.endTime.toMillis() === mapped.endMs &&
          previous.allDay === mapped.allDay &&
          previous.timeZone === mapped.timeZone &&
          JSON.stringify(previous.recurrence ?? null) ===
            JSON.stringify(mapped.recurrence)) {
        summary.unchanged += 1;
        continue;
      }
      writes.push({
        ref: schedulesRef.doc(id),
        data: {
          userId,
          title: mapped.title,
          startTime: Timestamp.fromMillis(mapped.startMs),
          endTime: Timestamp.fromMillis(mapped.endMs),
          isMandatory: true,
          source: "google",
          status: "confirmed",
          googleEventId: mapped.googleEventId,
          googleCalendarId: mapped.googleCalendarId,
          allDay: mapped.allDay,
          timeZone: mapped.timeZone,
          recurrence: mapped.recurrence,
          createdAt: previous?.createdAt || Timestamp.fromMillis(
            mapped.createdAtMs || Date.now()
          ),
          updatedAt: syncedAt,
        },
      });
      if (previous) {
        summary.updated += 1;
      } else {
        summary.imported += 1;
      }
    }
    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken);

  for (const [id, data] of existing) {
    const startTime = data.startTime as Timestamp | undefined;
    if (!startTime || seen.has(id) || data.status === "cancelled" ||
        data.googleCalendarId !== calendarId) {
      continue;
    }
    const startMs = startTime.toMillis();
    if (startMs >= windowStart.toMillis() && startMs < windowEnd.toMillis()) {
      writes.push({
        ref: schedulesRef.doc(id),
        data: {status: "cancelled", updatedAt: syncedAt},
      });
      summary.cancelled += 1;
    }
  }

  await commitWrites(writes);
  await db.collection("calendarConnections").doc(userId).set(
    {lastSyncedAt: syncedAt},
    {merge: true}
  );
  return summary;
}
