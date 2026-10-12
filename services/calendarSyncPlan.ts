export interface GoogleScheduleChange {
  id: string;
  googleEventId: string;
  googleCalendarId: string;
  appScheduleId: string | null;
  title: string;
  startMs: number;
  endMs: number;
  allDay: boolean;
  timeZone: string;
  recurrence: string[] | null;
  recurringEventId: string | null;
  originalStartTime: string | null;
  etag: string | null;
}

export interface CalendarSyncChanges {
  calendarId: string;
  mode: "full" | "incremental";
  events: GoogleScheduleChange[];
  cancelledIds: string[];
  nextSyncToken: string;
}

export interface ExistingSchedule {
  source: "manual" | "google";
  status: "confirmed" | "cancelled";
  title: string;
  startMs: number;
  endMs: number;
  googleEventId: string | null;
  googleCalendarId: string | null;
  allDay: boolean;
  timeZone: string;
  recurrence: string[] | null;
  recurringEventId?: string | null;
  originalStartTime?: string | null;
  etag?: string | null;
}

export type PlannedSyncWrite =
  | {id: string; kind: "upsert"; event: GoogleScheduleChange}
  | {id: string; kind: "cancel"};

export interface SyncSummary {
  imported: number;
  updated: number;
  unchanged: number;
  cancelled: number;
}

export function planCalendarSync(
  existing: Map<string, ExistingSchedule>,
  changes: CalendarSyncChanges,
  windowStartMs: number,
  windowEndMs: number
): {writes: PlannedSyncWrite[]; summary: SyncSummary} {
  const writes: PlannedSyncWrite[] = [];
  const summary: SyncSummary = {imported: 0, updated: 0, unchanged: 0, cancelled: 0};
  const seen = new Set<string>();
  for (const event of changes.events) {
    if (event.googleCalendarId !== changes.calendarId) {
      throw new Error("Kalender acara tidak cocok dengan hasil sinkronisasi.");
    }
    seen.add(event.id);
    const manual = event.appScheduleId ? existing.get(event.appScheduleId) : undefined;
    if (manual?.source === "manual" && manual.googleEventId === event.googleEventId) {
      continue;
    }
    const previous = existing.get(event.id);
    if (previous?.source === "manual") {
      throw new Error("ID jadwal Google bertabrakan dengan jadwal manual.");
    }
    if (previous?.source === "google" && previous.status === "confirmed" &&
        previous.googleEventId === event.googleEventId &&
        previous.googleCalendarId === event.googleCalendarId &&
        previous.title === event.title && previous.startMs === event.startMs &&
        previous.endMs === event.endMs && previous.allDay === event.allDay &&
        previous.timeZone === event.timeZone &&
        JSON.stringify(previous.recurrence) === JSON.stringify(event.recurrence) &&
        (previous.recurringEventId || null) === event.recurringEventId &&
        (previous.originalStartTime || null) === event.originalStartTime &&
        (previous.etag || null) === event.etag) {
      summary.unchanged++;
      continue;
    }
    writes.push({id: event.id, kind: "upsert", event});
    if (previous) summary.updated++; else summary.imported++;
  }
  const cancelled = new Set(changes.cancelledIds);
  if (changes.mode === "full") {
    for (const [id, schedule] of existing) {
      if (schedule.source === "google" && schedule.googleCalendarId === changes.calendarId &&
          schedule.status === "confirmed" && schedule.endMs > windowStartMs &&
          schedule.startMs < windowEndMs && !seen.has(id)) {
        cancelled.add(id);
      }
    }
  }
  for (const id of cancelled) {
    const previous = existing.get(id);
    if (previous?.source === "google" && previous.googleCalendarId === changes.calendarId &&
        previous.status === "confirmed") {
      writes.push({id, kind: "cancel"});
      summary.cancelled++;
    }
  }
  return {writes, summary};
}
