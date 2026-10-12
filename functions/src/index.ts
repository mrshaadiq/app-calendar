import {getApps, initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {FieldValue, getFirestore, Timestamp} from "firebase-admin/firestore";
import type {DocumentData, QueryDocumentSnapshot} from "firebase-admin/firestore";
import {logger} from "firebase-functions";
import {defineSecret} from "firebase-functions/params";
import {HttpsError, onCall} from "firebase-functions/v2/https";
import {createOAuthClient} from "./google/calendarClient";
import {syncGoogleCalendarForUser} from "./google/syncCalendar";
import {
  scheduleTasks,
  type TaskAllocation,
  type SchedulingTask,
  type TimeInterval,
} from "./scheduler/scheduleTask";

if (getApps().length === 0) {
  initializeApp();
}

const googleClientId = defineSecret("GOOGLE_CLIENT_ID");
const googleClientSecret = defineSecret("GOOGLE_CLIENT_SECRET");
const region = "asia-southeast2";

function requireUserId(auth: {uid: string} | undefined): string {
  if (!auth?.uid) {
    throw new HttpsError("unauthenticated", "Silakan login terlebih dahulu.");
  }
  return auth.uid;
}

export const connectGoogleCalendar = onCall(
  {region, secrets: [googleClientId, googleClientSecret]},
  async (request) => {
    const userId = requireUserId(request.auth);
    const code = request.data?.serverAuthCode;
    if (typeof code !== "string" || !code || code.length > 10000) {
      throw new HttpsError("invalid-argument", "Kode otorisasi Google tidak valid.");
    }

    try {
      const clientId = googleClientId.value();
      const oauth = createOAuthClient(clientId, googleClientSecret.value());
      const {tokens} = await oauth.getToken(code);
      if (!tokens.id_token) {
        throw new HttpsError("failed-precondition", "Google tidak memberikan ID token.");
      }
      const ticket = await oauth.verifyIdToken({
        idToken: tokens.id_token,
        audience: clientId,
      });
      const googleAccountId = ticket.getPayload()?.sub;
      const firebaseUser = await getAuth().getUser(userId);
      const googleProvider = firebaseUser.providerData.find(
        (provider) => provider.providerId === "google.com"
      );
      if (!googleAccountId || googleProvider?.uid !== googleAccountId) {
        throw new HttpsError(
          "permission-denied",
          "Akun Google Calendar berbeda dari akun yang login."
        );
      }

      const connectionRef = getFirestore()
        .collection("calendarConnections").doc(userId);
      const existing = await connectionRef.get();
      const existingToken = existing.get("googleAccountId") === googleAccountId ?
        existing.get("refreshToken") : null;
      const refreshToken = tokens.refresh_token || existingToken;
      if (typeof refreshToken !== "string" || !refreshToken) {
        throw new HttpsError(
          "failed-precondition",
          "Izin kalender perlu diberikan ulang agar sinkronisasi dapat berjalan."
        );
      }

      await connectionRef.set({
        googleAccountId,
        refreshToken,
        connectedAt: existing.get("connectedAt") || FieldValue.serverTimestamp(),
      }, {merge: true});
      return {connected: true};
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("Failed to connect Google Calendar", error);
      throw new HttpsError("internal", "Gagal menghubungkan Google Calendar.");
    }
  }
);

export const syncGoogleCalendar = onCall(
  {region, secrets: [googleClientId, googleClientSecret]},
  async (request) => {
    const userId = requireUserId(request.auth);
    const db = getFirestore();
    const connection = await db.collection("calendarConnections")
      .doc(userId).get();
    const refreshToken = connection.get("refreshToken");
    if (typeof refreshToken !== "string" || !refreshToken) {
      throw new HttpsError(
        "failed-precondition",
        "Hubungkan Google Calendar terlebih dahulu."
      );
    }

    const profile = await db.collection("users").doc(userId).get();
    const timeZone = typeof profile.get("timeZone") === "string" ?
      profile.get("timeZone") as string : "Asia/Jakarta";
    try {
      return await syncGoogleCalendarForUser(
        userId,
        refreshToken,
        googleClientId.value(),
        googleClientSecret.value(),
        timeZone
      );
    } catch (error) {
      logger.error("Failed to sync Google Calendar", error);
      throw new HttpsError("internal", "Gagal menyinkronkan Google Calendar.");
    }
  }
);

interface SchedulingState {
  allocations: TaskAllocation[];
  taskDocs: Map<string, QueryDocumentSnapshot<DocumentData>>;
}

async function getSchedulingState(userId: string): Promise<SchedulingState> {
  const db = getFirestore();
  const userRef = db.collection("users").doc(userId);
  const [profile, schedules, tasks] = await Promise.all([
    userRef.get(),
    userRef.collection("schedules").get(),
    userRef.collection("tasks").get(),
  ]);
  if (tasks.size > 400) {
    throw new HttpsError(
      "resource-exhausted",
      "Terlalu banyak tugas untuk dijadwalkan sekaligus."
    );
  }

  const timeZone = typeof profile.get("timeZone") === "string" ?
    profile.get("timeZone") as string : "Asia/Jakarta";
  const busy: TimeInterval[] = [];
  for (const schedule of schedules.docs) {
    const data = schedule.data();
    if (data.status === "confirmed" && data.isMandatory &&
        data.startTime instanceof Timestamp &&
        data.endTime instanceof Timestamp) {
      busy.push({
        startMs: data.startTime.toMillis(),
        endMs: data.endTime.toMillis(),
      });
    }
  }

  const pending: SchedulingTask[] = [];
  const taskDocs = new Map(tasks.docs.map((task) => [task.id, task]));
  for (const task of tasks.docs) {
    const data = task.data();
    if (data.status === "scheduled" &&
        data.scheduledStartTime instanceof Timestamp &&
        data.scheduledEndTime instanceof Timestamp) {
      busy.push({
        startMs: data.scheduledStartTime.toMillis(),
        endMs: data.scheduledEndTime.toMillis(),
      });
    }
    if ((data.status === "pending" || data.status === "unscheduled") &&
        data.deadline instanceof Timestamp &&
        typeof data.estimatedDurationMinutes === "number" &&
        data.estimatedDurationMinutes > 0) {
      pending.push({
        id: task.id,
        deadlineMs: data.deadline.toMillis(),
        durationMinutes: data.estimatedDurationMinutes,
      });
    }
  }

  let allocations: TaskAllocation[];
  try {
    allocations = scheduleTasks(pending, busy, Date.now(), timeZone);
  } catch (error) {
    logger.error("Task scheduling failed", error);
    throw new HttpsError("invalid-argument", "Zona waktu pengguna tidak valid.");
  }
  return {allocations, taskDocs};
}

export const previewTaskScheduling = onCall({region}, async (request) => {
  const userId = requireUserId(request.auth);
  const {allocations, taskDocs} = await getSchedulingState(userId);
  if (allocations.length === 0) {
    return {proposalId: null, allocations: []};
  }
  const proposalRef = getFirestore().collection("users").doc(userId)
    .collection("schedulingRuns").doc();
  await proposalRef.set({
    state: "preview",
    createdAt: Timestamp.now(),
    allocations,
  });
  return {
    proposalId: proposalRef.id,
    allocations: allocations.map((item) => ({
      ...item,
      taskTitle: taskDocs.get(item.taskId)?.get("title") || "Tugas",
    })),
  };
});

export const applyTaskScheduling = onCall({region}, async (request) => {
  const userId = requireUserId(request.auth);
  const proposalId = request.data?.proposalId;
  if (typeof proposalId !== "string" || !/^[A-Za-z0-9]{20}$/.test(proposalId)) {
    throw new HttpsError("invalid-argument", "Usulan penjadwalan tidak valid.");
  }
  const userRef = getFirestore().collection("users").doc(userId);
  const proposalRef = userRef.collection("schedulingRuns").doc(proposalId);
  const proposal = await proposalRef.get();
  const createdAt = proposal.get("createdAt");
  if (proposal.get("state") !== "preview" ||
      !(createdAt instanceof Timestamp) ||
      Date.now() - createdAt.toMillis() > 10 * 60_000) {
    throw new HttpsError("failed-precondition", "Usulan kedaluwarsa. Buat pratinjau baru.");
  }
  const {allocations, taskDocs} = await getSchedulingState(userId);
  if (JSON.stringify(allocations) !== JSON.stringify(proposal.get("allocations"))) {
    throw new HttpsError(
      "failed-precondition", "Jadwal berubah. Tinjau usulan yang baru."
    );
  }
  const previous = allocations.map((item) => {
    const task = taskDocs.get(item.taskId);
    if (!task) {
      throw new HttpsError("failed-precondition", "Ada tugas yang sudah hilang.");
    }
    return {
      taskId: item.taskId,
      status: task.get("status"),
      scheduledStartTime: task.get("scheduledStartTime") || null,
      scheduledEndTime: task.get("scheduledEndTime") || null,
      unscheduledReason: task.get("unscheduledReason") || null,
    };
  });
  const batch = getFirestore().batch();
  for (const item of allocations) {
    batch.update(userRef.collection("tasks").doc(item.taskId), {
      scheduledStartTime: item.startMs === null ? null :
        Timestamp.fromMillis(item.startMs),
      scheduledEndTime: item.endMs === null ? null :
        Timestamp.fromMillis(item.endMs),
      status: item.status,
      unscheduledReason: item.reason || null,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  batch.update(proposalRef, {state: "applied", previous, appliedAt: Timestamp.now()});
  await batch.commit();
  return {
    scheduled: allocations.filter((item) => item.status === "scheduled").length,
    unscheduled: allocations.filter((item) => item.status === "unscheduled").length,
  };
});

export const undoTaskScheduling = onCall({region}, async (request) => {
  const userId = requireUserId(request.auth);
  const proposalId = request.data?.proposalId;
  if (typeof proposalId !== "string" || !/^[A-Za-z0-9]{20}$/.test(proposalId)) {
    throw new HttpsError("invalid-argument", "Riwayat penjadwalan tidak valid.");
  }
  const userRef = getFirestore().collection("users").doc(userId);
  const proposalRef = userRef.collection("schedulingRuns").doc(proposalId);
  const proposal = await proposalRef.get();
  const appliedAt = proposal.get("appliedAt");
  if (proposal.get("state") !== "applied" ||
      !(appliedAt instanceof Timestamp) ||
      Date.now() - appliedAt.toMillis() > 10 * 60_000) {
    throw new HttpsError("failed-precondition", "Jendela batal sudah berakhir.");
  }
  const allocations = proposal.get("allocations") as TaskAllocation[];
  const previous = proposal.get("previous") as Array<{
    taskId: string;
    status: string;
    scheduledStartTime: Timestamp | null;
    scheduledEndTime: Timestamp | null;
    unscheduledReason: string | null;
  }>;
  const current = await Promise.all(allocations.map((item) =>
    userRef.collection("tasks").doc(item.taskId).get()
  ));
  for (let i = 0; i < allocations.length; i++) {
    const item = allocations[i];
    const task = current[i];
    const start = task.get("scheduledStartTime") as Timestamp | null;
    const end = task.get("scheduledEndTime") as Timestamp | null;
    if (!task.exists || task.get("status") !== item.status ||
        (start?.toMillis() ?? null) !== item.startMs ||
        (end?.toMillis() ?? null) !== item.endMs) {
      throw new HttpsError("failed-precondition", "Tugas sudah berubah; batal tidak aman.");
    }
  }
  const batch = getFirestore().batch();
  for (const item of previous) {
    batch.update(userRef.collection("tasks").doc(item.taskId), {
      status: item.status,
      scheduledStartTime: item.scheduledStartTime,
      scheduledEndTime: item.scheduledEndTime,
      unscheduledReason: item.unscheduledReason,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  batch.update(proposalRef, {state: "undone", undoneAt: Timestamp.now()});
  await batch.commit();
  return {undone: previous.length};
});
