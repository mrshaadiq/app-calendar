import {
  Timestamp,
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "./firebase";
import type { TaskDocument } from "../types/models";
import type { TaskPriority } from "../types/models";

export interface NewTaskInput {
  title: string;
  deadline: Date | null;
  deadlineHasTime?: boolean;
  priority?: TaskPriority;
  estimatedDurationMinutes: number;
}

export async function createTask(
  userId: string,
  input: NewTaskInput
): Promise<string> {
  const title = input.title.trim();
  if (!title) {
    throw new Error("Judul tugas wajib diisi.");
  }

  if (!Number.isInteger(input.estimatedDurationMinutes) ||
      input.estimatedDurationMinutes <= 0) {
    throw new Error("Durasi tugas harus berupa bilangan menit yang lebih dari 0.");
  }

  if (input.deadline && !Number.isFinite(input.deadline.getTime())) {
    throw new Error("Deadline tugas tidak valid.");
  }

  if (!["low", "medium", "high"].includes(input.priority)) {
    throw new Error("Prioritas tugas tidak valid.");
  }

  const data = {
    userId,
    title,
    deadline: input.deadline ? Timestamp.fromDate(input.deadline) : null,
    deadlineHasTime: input.deadline !== null && input.deadlineHasTime,
    priority: input.priority,
    estimatedDurationMinutes: input.estimatedDurationMinutes,
    remainingDurationMinutes: input.estimatedDurationMinutes,
    scheduledStartTime: null,
    scheduledEndTime: null,
    scheduledSessions: [],
    status: "pending",
    unscheduledReason: null,
    deletedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

export async function getUserTasks(
  userId: string
): Promise<(TaskDocument & { id: string })[]> {
  const tasksQuery = query(
    collection(db, "users", userId, "tasks"),
    orderBy("deadline", "asc")
  );
  const snapshot = await getDocs(tasksQuery);
  return snapshot.docs.map((taskDoc) => ({
    id: taskDoc.id,
    ...taskDoc.data() as TaskDocument,
  }));
}

function normalizeTaskDocument(task: TaskDocument): TaskDocument {
  return {
    ...task,
    deadline: task.deadline ?? null,
    deadlineHasTime: task.deadline ? task.deadlineHasTime ?? true : false,
    priority: task.priority ?? "medium",
    remainingDurationMinutes: task.remainingDurationMinutes ?? task.estimatedDurationMinutes,
    scheduledSessions: task.scheduledSessions ?? 
      (task.scheduledStartTime && task.scheduledEndTime ? [{
        id: "legacy",
        startTime: task.scheduledStartTime,
        endTime: task.scheduledEndTime,
      }] : [])
  };
}

export async function updateTask(
  userId: string,
  taskId: string,
  input: NewTaskInput
): Promise<void> {
  const title = input.title.trim();
  if (!title || input.estimatedDurationMinutes <= 0) {
    throw new Error("Judul dan durasi tugas harus valid.");
  }

  const ref = doc(db, "users", userId, "tasks", taskId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error("Tugas tidak ditemukan.");

  await updateDoc(ref, {
    title,
    deadline: input.deadline ? Timestamp.fromDate(input.deadline) : null,
    deadlineHasTime: input.deadline !== null && input.deadlineHasTime,
    priority: input.priority,
    estimatedDurationMinutes: input.estimatedDurationMinutes,
    remainingDurationMinutes: input.estimatedDurationMinutes,
    updatedAt: serverTimestamp(),
  });
}

export async function completeTask(
  userId: string,
  taskId: string,
  removeFutureSessions: boolean
): Promise<void> {
  const ref = doc(db, "users", userId, "tasks", taskId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error("Tugas tidak ditemukan.");

  const task = normalizeTask(snapshot.data() as TaskDocument);
  const sessions = removeFutureSessions
    ? task.scheduledSessions!.filter(
        (session) => session.endTime.toMillis() <= Date.now()
      )
    : task.scheduledSessions!;

  await updateDoc(ref, {
    status: "completed",
    remainingDurationMinutes: 0,
    scheduledSessions: sessions,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTask(
  userId: string,
  taskId: string,
  removeFutureSessions: boolean
): Promise<void> {
  const ref = doc(db, "users", userId, "tasks", taskId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error("Tugas tidak ditemukan.");

  const task = normalizeTask(snapshot.data() as TaskDocument);
  const sessions = removeFutureSessions
    ? task.scheduledSessions!.filter(
        (session) => session.endTime.toMillis() <= Date.now()
      )
    : task.scheduledSessions!;

  await updateDoc(ref, {
    status: "cancelled",
    deletedAt: serverTimestamp(),
    scheduledSessions: sessions,
    updatedAt: serverTimestamp(),
  });
}