import type { Timestamp } from "firebase/firestore";

export type ScheduleSource = "manual" | "google";
export type ScheduleStatus = "confirmed" | "cancelled";
export type TaskPriority = "low" | "medium" | "high";

export interface ScheduleDocument {
    userId: string;
    title: string;
    startTime: Timestamp;
    endTime: Timestamp;
    isMandatory: boolean;
    source: ScheduleSource;
    status: ScheduleStatus;

    googleEventId: string | null;
    googleCalendarId: string | null;

    allDay: boolean;
    timeZone: string;
    recurrence: string[] | null;
    recurringEventId?: string | null;
    originalStartTime?: string | null;
    etag?: string | null;

    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export type TaskStatus = "pending" | "scheduled" | "completed" | "cancelled" | "unscheduled";

export interface TaskSession {
    taskId: string;
    startTime: Timestamp;
    endTime: Timestamp;
}

export interface TaskDocument {
    userId: string;
    title: string;
    deadline: Timestamp | null;
    deadlineHasTime?: boolean;
    priority?: TaskPriority;
    estimatedDurationMinutes: number;
    remainingDurationMinutes: number;
    scheduledStartTime: Timestamp | null;
    scheduledEndTime: Timestamp | null;
    status: TaskStatus;
    unscheduledReason?: "no_available_slot" | null;
    deletedAt?: Timestamp | null;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

