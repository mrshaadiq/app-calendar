import {DateTime} from "luxon";

export interface TimeInterval {
  startMs: number;
  endMs: number;
}

export interface SchedulingTask {
  id: string;
  deadlineMs: number;
  durationMinutes: number;
}

export interface TaskAllocation {
  taskId: string;
  startMs: number | null;
  endMs: number | null;
  status: "scheduled" | "unscheduled";
  reason?: "no_available_slot";
}

function mergeIntervals(intervals: TimeInterval[]): TimeInterval[] {
  const sorted = intervals
    .filter((item) => item.endMs > item.startMs)
    .sort((a, b) => a.startMs - b.startMs);
  const merged: TimeInterval[] = [];

  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (last && interval.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, interval.endMs);
    } else {
      merged.push({...interval});
    }
  }

  return merged;
}

function roundUpToQuarter(ms: number, timeZone: string): number {
  const local = DateTime.fromMillis(ms, {zone: timeZone});
  const roundedMinute = Math.ceil(local.minute / 15) * 15;
  let rounded = local.startOf("hour").plus({minutes: roundedMinute});
  if (rounded.toMillis() < ms) {
    rounded = rounded.plus({minutes: 15});
  }
  return rounded.toMillis();
}

function findSlot(
  task: SchedulingTask,
  busy: TimeInterval[],
  nowMs: number,
  timeZone: string
): TimeInterval | null {
  const durationMs = task.durationMinutes * 60_000;
  let day = DateTime.fromMillis(nowMs, {zone: timeZone}).startOf("day");

  while (day.toMillis() < task.deadlineMs) {
    const dayStart = day.set({hour: 8}).toMillis();
    const dayEnd = Math.min(day.set({hour: 21}).toMillis(), task.deadlineMs);
    let cursor = roundUpToQuarter(Math.max(nowMs, dayStart), timeZone);

    for (const interval of busy) {
      if (interval.endMs <= cursor || interval.startMs >= dayEnd) {
        continue;
      }
      if (cursor + durationMs <= Math.min(interval.startMs, dayEnd)) {
        return {startMs: cursor, endMs: cursor + durationMs};
      }
      cursor = roundUpToQuarter(Math.max(cursor, interval.endMs), timeZone);
      if (cursor + durationMs > dayEnd) {
        break;
      }
    }

    if (cursor + durationMs <= dayEnd) {
      return {startMs: cursor, endMs: cursor + durationMs};
    }
    day = day.plus({days: 1});
  }

  return null;
}

export function scheduleTasks(
  tasks: SchedulingTask[],
  busyIntervals: TimeInterval[],
  nowMs: number,
  timeZone: string
): TaskAllocation[] {
  if (!DateTime.now().setZone(timeZone).isValid) {
    throw new Error(`Invalid time zone: ${timeZone}`);
  }

  let busy = mergeIntervals(busyIntervals);
  const orderedTasks = [...tasks].sort(
    (a, b) => a.deadlineMs - b.deadlineMs || a.id.localeCompare(b.id)
  );

  return orderedTasks.map((task) => {
    const slot = findSlot(task, busy, nowMs, timeZone);
    if (!slot) {
      return {
        taskId: task.id,
        startMs: null,
        endMs: null,
        status: "unscheduled" as const,
        reason: "no_available_slot" as const,
      };
    }

    busy = mergeIntervals([...busy, slot]);
    return {
      taskId: task.id,
      startMs: slot.startMs,
      endMs: slot.endMs,
      status: "scheduled" as const,
    };
  });
}
