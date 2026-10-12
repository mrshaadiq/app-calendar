import {
  Timestamp,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  doc,
} from "firebase/firestore";

import { db } from "./firebase";
import type { ScheduleDocument } from "../types/models";

export interface ManualScheduleInput {
  title: string;
  startTime: Date;
  endTime: Date;
  recurrence?: string[];
}

export async function createManualSchedule(
  userId: string,
  input: ManualScheduleInput
): Promise<string> {
  if (!input.title.trim()) {
    throw new Error("Judul jadwal wajib diisi.");
  }

  if (input.endTime <= input.startTime) {
    throw new Error("Waktu selesai harus setelah waktu mulai.");
  }

  if (!Number.isFinite(input.startTime.getTime()) ||
      !Number.isFinite(input.endTime.getTime())) {
    throw new Error("Tanggal jadwal tidak valid.");
  }

  const scheduleRef = doc(
    collection(db, "users", userId, "schedules")
  );

  await setDoc(scheduleRef, {
    userId,
    title: input.title.trim(),
    startTime: Timestamp.fromDate(input.startTime),
    endTime: Timestamp.fromDate(input.endTime),
    isMandatory: true,
    source: "manual",
    status: "confirmed",

    googleEventId: null,
    googleCalendarId: null,

    allDay: false,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jakarta",
    recurrence: input.recurrence ?? null,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return scheduleRef.id;
}

export async function getUserSchedules(
  userId: string
): Promise<(ScheduleDocument & { id: string })[]> {
  const schedulesRef = collection(
    db,
    "users",
    userId,
    "schedules"
  );

  const schedulesQuery = query(
    schedulesRef,
    orderBy("startTime", "asc")
  );

  const snapshot = await getDocs(schedulesQuery);

  return snapshot.docs.map((scheduleDoc) => ({
    id: scheduleDoc.id,
    ...scheduleDoc.data() as ScheduleDocument,
  }));
}
