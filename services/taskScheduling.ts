import {
  Timestamp, collection, doc, getDocs, getDoc, runTransaction, serverTimestamp,
} from "firebase/firestore";
import {auth} from "./auth";
import {db} from "./firebase";
import {scheduleTasks, type TaskAllocation, type TimeInterval} from "./schedulerEngine";
import type {ScheduleDocument, TaskDocument} from "../types/models";

export interface TaskSchedulingPreview {
  proposalId: string | null;
  allocations: (TaskAllocation & {taskTitle: string})[];
}

type PreviousTask = {
  taskId: string; status: TaskDocument["status"];
  scheduledStartMs: number | null; scheduledEndMs: number | null;
  unscheduledReason: string | null;
};

async function state(uid: string) {
  const [scheduleDocs, taskDocs] = await Promise.all([
    getDocs(collection(db, "users", uid, "schedules")),
    getDocs(collection(db, "users", uid, "tasks")),
  ]);
  if (scheduleDocs.size + taskDocs.size > 100) {
    throw new Error("Terlalu banyak dokumen untuk satu usulan penjadwalan.");
  }
  const busy: TimeInterval[] = [];
  const pending: {id: string; deadlineMs: number; durationMinutes: number}[] = [];
  const tasks = new Map<string, TaskDocument>();
  for (const item of scheduleDocs.docs) {
    const schedule = item.data() as ScheduleDocument;
    if (schedule.status === "confirmed" && schedule.isMandatory) {
      busy.push({startMs: schedule.startTime.toMillis(), endMs: schedule.endTime.toMillis()});
    }
  }
  for (const item of taskDocs.docs) {
    const task = item.data() as TaskDocument;
    tasks.set(item.id, task);
    if (task.status === "scheduled" && task.scheduledStartTime && task.scheduledEndTime) {
      busy.push({startMs: task.scheduledStartTime.toMillis(), endMs: task.scheduledEndTime.toMillis()});
    }
    if (task.status === "pending" || task.status === "unscheduled") {
      pending.push({id: item.id, deadlineMs: task.deadline.toMillis(),
        durationMinutes: task.estimatedDurationMinutes});
    }
  }
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jakarta";
  const allocations = scheduleTasks(pending, busy, Date.now(), timeZone);
  const fingerprint = JSON.stringify({
    schedules: scheduleDocs.docs.map((item) => [item.id, (item.data() as ScheduleDocument).updatedAt?.toMillis()]),
    tasks: taskDocs.docs.map((item) => [item.id, (item.data() as TaskDocument).updatedAt?.toMillis()]),
  });
  return {allocations, tasks, fingerprint};
}

export async function previewTaskScheduling(): Promise<TaskSchedulingPreview> {
  const user = auth.currentUser;
  if (!user) throw new Error("Masuk terlebih dahulu.");
  const current = await state(user.uid);
  if (!current.allocations.length) return {proposalId: null, allocations: []};
  const proposalRef = doc(collection(db, "users", user.uid, "schedulingRuns"));
  await runTransaction(db, async (transaction) => {
    transaction.set(proposalRef, {
      userId: user.uid, state: "preview", createdAt: Timestamp.now(),
      allocations: current.allocations, fingerprint: current.fingerprint,
    });
  });
  return {proposalId: proposalRef.id, allocations: current.allocations.map((item) => ({
    ...item, taskTitle: current.tasks.get(item.taskId)?.title || "Tugas",
  }))};
}

export async function applyTaskScheduling(proposalId: string): Promise<{
  scheduled: number; unscheduled: number;
}> {
  const user = auth.currentUser;
  if (!user) throw new Error("Masuk terlebih dahulu.");
  const ref = doc(db, "users", user.uid, "schedulingRuns", proposalId);
  const proposal = await getDoc(ref);
  const data = proposal.data();
  if (!data || data.state !== "preview" || Date.now() - data.createdAt.toMillis() > 600_000) {
    throw new Error("Usulan kedaluwarsa. Buat pratinjau baru.");
  }
  const current = await state(user.uid);
  if (current.fingerprint !== data.fingerprint ||
      JSON.stringify(current.allocations) !== JSON.stringify(data.allocations)) {
    throw new Error("Data berubah. Tinjau usulan baru.");
  }
  const allocations = data.allocations as TaskAllocation[];
  const previous: PreviousTask[] = allocations.map((item) => {
    const task = current.tasks.get(item.taskId);
    if (!task) throw new Error("Tugas tidak ditemukan.");
    return {taskId: item.taskId, status: task.status,
      scheduledStartMs: task.scheduledStartTime?.toMillis() ?? null,
      scheduledEndMs: task.scheduledEndTime?.toMillis() ?? null,
      unscheduledReason: task.unscheduledReason || null};
  });
  await runTransaction(db, async (transaction) => {
    const latestProposal = await transaction.get(ref);
    const refs = allocations.map((item) => doc(db, "users", user.uid, "tasks", item.taskId));
    const latestTasks = await Promise.all(refs.map((item) => transaction.get(item)));
    if (latestProposal.data()?.state !== "preview") throw new Error("Usulan sudah dipakai.");
    latestTasks.forEach((snapshot, index) => {
      if (!snapshot.exists() || (snapshot.data() as TaskDocument).updatedAt?.toMillis() !==
          current.tasks.get(allocations[index].taskId)?.updatedAt?.toMillis()) {
        throw new Error("Tugas berubah. Buat usulan baru.");
      }
    });
    allocations.forEach((item, index) => transaction.update(refs[index], {
      scheduledStartTime: item.startMs === null ? null : Timestamp.fromMillis(item.startMs),
      scheduledEndTime: item.endMs === null ? null : Timestamp.fromMillis(item.endMs),
      status: item.status, unscheduledReason: item.reason || null, updatedAt: serverTimestamp(),
    }));
    transaction.update(ref, {state: "applied", previous, appliedAt: Timestamp.now()});
  });
  return {scheduled: allocations.filter((item) => item.status === "scheduled").length,
    unscheduled: allocations.filter((item) => item.status === "unscheduled").length};
}

export async function undoTaskScheduling(proposalId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Masuk terlebih dahulu.");
  const ref = doc(db, "users", user.uid, "schedulingRuns", proposalId);
  await runTransaction(db, async (transaction) => {
    const proposal = await transaction.get(ref);
    const data = proposal.data();
    if (!data || data.state !== "applied" || Date.now() - data.appliedAt.toMillis() > 600_000) {
      throw new Error("Jendela pembatalan sudah berakhir.");
    }
    const allocations = data.allocations as TaskAllocation[];
    const previous = data.previous as PreviousTask[];
    const refs = allocations.map((item) => doc(db, "users", user.uid, "tasks", item.taskId));
    const current = await Promise.all(refs.map((item) => transaction.get(item)));
    current.forEach((snapshot, index) => {
      const task = snapshot.data() as TaskDocument | undefined;
      const allocation = allocations[index];
      if (!task || task.status !== allocation.status ||
          task.scheduledStartTime?.toMillis() !== (allocation.startMs ?? undefined) ||
          task.scheduledEndTime?.toMillis() !== (allocation.endMs ?? undefined)) {
        throw new Error("Tugas berubah; pembatalan tidak aman.");
      }
    });
    previous.forEach((item, index) => transaction.update(refs[index], {
      status: item.status,
      scheduledStartTime: item.scheduledStartMs === null ? null : Timestamp.fromMillis(item.scheduledStartMs),
      scheduledEndTime: item.scheduledEndMs === null ? null : Timestamp.fromMillis(item.scheduledEndMs),
      unscheduledReason: item.unscheduledReason, updatedAt: serverTimestamp(),
    }));
    transaction.update(ref, {state: "undone", undoneAt: Timestamp.now()});
  });
}
