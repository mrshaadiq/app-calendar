import {DateTime} from "luxon";

export interface TimelineSchedule {
  id: string;
  title: string;
  startMs: number;
  endMs: number;
  status: "confirmed" | "cancelled";
  source: "manual" | "google";
  googleCalendarId: string | null;
}

export interface TimelineTask {
  id: string;
  title: string;
  startMs: number | null;
  endMs: number | null;
  status: string;
}

export interface TimelineEntry {
  id: string;
  kind: "schedule" | "task" | "free";
  title: string;
  startMs: number;
  endMs: number;
  conflict: boolean;
  source?: "manual" | "google";
}

function validDay(dateISO: string, timeZone: string): DateTime {
  const day = DateTime.fromISO(dateISO, {zone: timeZone}).startOf("day");
  if (!day.isValid || day.toISODate() !== dateISO) {
    throw new Error("Tanggal atau zona waktu tidak valid.");
  }
  return day;
}

export function weekDays(dateISO: string, timeZone: string): string[] {
  const day = validDay(dateISO, timeZone);
  const monday = day.minus({days: day.weekday - 1});
  return Array.from({length: 7}, (_, index) =>
    monday.plus({days: index}).toISODate()!);
}

export function buildDayTimeline(
  dateISO: string,
  timeZone: string,
  schedules: TimelineSchedule[],
  tasks: TimelineTask[],
  selectedCalendarIds: string[],
  workStartHour = 8,
  workEndHour = 21
): TimelineEntry[] {
  const day = validDay(dateISO, timeZone);
  if (workStartHour < 0 || workEndHour > 24 || workStartHour >= workEndHour) {
    throw new Error("Jam kerja tidak valid.");
  }
  const dayStart = day.toMillis();
  const dayEnd = day.plus({days: 1}).toMillis();
  const commitments: TimelineEntry[] = [];
  for (const schedule of schedules) {
    if (schedule.status !== "confirmed" ||
        (schedule.source === "google" &&
         !selectedCalendarIds.includes(schedule.googleCalendarId || "")) ||
        schedule.endMs <= dayStart || schedule.startMs >= dayEnd) continue;
    commitments.push({
      id: schedule.id, kind: "schedule", title: schedule.title,
      startMs: Math.max(schedule.startMs, dayStart),
      endMs: Math.min(schedule.endMs, dayEnd),
      conflict: false, source: schedule.source,
    });
  }
  for (const task of tasks) {
    if (task.status !== "scheduled" || task.startMs === null ||
        task.endMs === null || task.endMs <= dayStart || task.startMs >= dayEnd) continue;
    commitments.push({
      id: task.id, kind: "task", title: task.title,
      startMs: Math.max(task.startMs, dayStart),
      endMs: Math.min(task.endMs, dayEnd), conflict: false,
    });
  }
  commitments.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
  for (let index = 0; index < commitments.length; index++) {
    for (let next = index + 1; next < commitments.length &&
         commitments[next].startMs < commitments[index].endMs; next++) {
      commitments[index].conflict = true;
      commitments[next].conflict = true;
    }
  }
  const workStart = day.set({hour: workStartHour}).toMillis();
  const workEnd = workEndHour === 24 ? dayEnd : day.set({hour: workEndHour}).toMillis();
  const free: TimelineEntry[] = [];
  let cursor = workStart;
  for (const item of commitments) {
    if (item.endMs <= workStart || item.startMs >= workEnd) continue;
    const busyStart = Math.max(item.startMs, workStart);
    if (busyStart > cursor) {
      free.push({id: `free_${cursor}`, kind: "free", title: "Waktu luang",
        startMs: cursor, endMs: busyStart, conflict: false});
    }
    cursor = Math.max(cursor, Math.min(item.endMs, workEnd));
  }
  if (cursor < workEnd) {
    free.push({id: `free_${cursor}`, kind: "free", title: "Waktu luang",
      startMs: cursor, endMs: workEnd, conflict: false});
  }
  return [...commitments, ...free].sort((a, b) =>
    a.startMs - b.startMs || Number(a.kind === "free") - Number(b.kind === "free"));
}
