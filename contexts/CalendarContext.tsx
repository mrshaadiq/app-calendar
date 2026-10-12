import {onAuthStateChanged, type User} from "firebase/auth";
import {doc, serverTimestamp, setDoc} from "firebase/firestore";
import {createContext, useCallback, useContext, useEffect, useState,
  type ReactNode} from "react";
import {auth} from "../services/auth";
import {db} from "../services/firebase";
import {signInWithGoogle, signOutGoogle} from "../services/googleAuth";
import {createManualSchedule, getUserSchedules,
  type ManualScheduleInput} from "../services/scheduleRepository";
import {createTask, getUserTasks, type NewTaskInput} from "../services/taskRepository";
import {applyTaskScheduling, previewTaskScheduling, undoTaskScheduling,
  type TaskSchedulingPreview} from "../services/taskScheduling";
import {connectGoogleCalendar, getCalendarChoices, publishManualSchedule,
  requestCalendarSync, setCalendarChoices, type CalendarOption} from
  "../services/calendarSyncClient";
import type {ScheduleDocument, TaskDocument} from "../types/models";

export type SavedSchedule = ScheduleDocument & {id: string};
export type SavedTask = TaskDocument & {id: string};

interface CalendarContextValue {
  user: User | null;
  authReady: boolean;
  busy: boolean;
  message: string;
  schedules: SavedSchedule[];
  tasks: SavedTask[];
  proposal: TaskSchedulingPreview | null;
  canUndo: boolean;
  calendarOptions: CalendarOption[];
  selectedCalendarIds: string[];
  lastSyncedAt: Date | null;
  syncStatus: "idle" | "running" | "success" | "error";
  login(): Promise<boolean>;
  logout(): Promise<boolean>;
  refresh(): Promise<boolean>;
  saveSchedule(input: ManualScheduleInput): Promise<boolean>;
  saveTask(input: NewTaskInput): Promise<boolean>;
  syncCalendar(): Promise<boolean>;
  loadCalendars(): Promise<boolean>;
  toggleCalendar(calendarId: string): Promise<boolean>;
  sendSchedule(schedule: SavedSchedule): Promise<boolean>;
  previewScheduling(): Promise<boolean>;
  confirmScheduling(): Promise<boolean>;
  dismissProposal(): void;
  undoScheduling(): Promise<boolean>;
}

const CalendarContext = createContext<CalendarContextValue | null>(null);

export function useCalendar(): CalendarContextValue {
  const context = useContext(CalendarContext);
  if (!context) throw new Error("CalendarProvider belum dipasang.");
  return context;
}

export function CalendarProvider({children}: {children: ReactNode}) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [schedules, setSchedules] = useState<SavedSchedule[]>([]);
  const [tasks, setTasks] = useState<SavedTask[]>([]);
  const [proposal, setProposal] = useState<TaskSchedulingPreview | null>(null);
  const [lastAppliedProposalId, setLastAppliedProposalId] = useState<string | null>(null);
  const [calendarOptions, setCalendarOptions] = useState<CalendarOption[]>([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<"idle" | "running" | "success" | "error">("idle");

  const loadData = useCallback(async (userId: string) => {
    const [loadedSchedules, loadedTasks] = await Promise.all([
      getUserSchedules(userId), getUserTasks(userId),
    ]);
    setSchedules(loadedSchedules);
    setTasks(loadedTasks);
  }, []);

  useEffect(() => onAuthStateChanged(auth, (nextUser) => {
    setUser(nextUser);
    setAuthReady(true);
    if (nextUser) {
      void loadData(nextUser.uid).catch((error) => {
        setMessage(error instanceof Error ? error.message : "Gagal mengambil data.");
      });
      void getCalendarChoices().then((choices) => {
        setCalendarOptions(choices.calendars);
        setSelectedCalendarIds(choices.selectedCalendarIds);
      }).catch(() => {
        // Data lokal tetap dapat dilihat saat Worker belum tersedia.
      });
    } else {
      setSchedules([]);
      setTasks([]);
      setProposal(null);
      setLastAppliedProposalId(null);
      setCalendarOptions([]);
      setSelectedCalendarIds([]);
      setLastSyncedAt(null);
      setSyncStatus("idle");
    }
  }), [loadData]);

  const run = async (action: () => Promise<void>): Promise<boolean> => {
    setBusy(true);
    setMessage("");
    try {
      await action();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Terjadi kesalahan.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const login = () => run(async () => {
    const result = await signInWithGoogle();
    if (!result) return;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jakarta";
    await setDoc(doc(db, "users", result.user.uid), {
      name: result.user.displayName, email: result.user.email,
      photoURL: result.user.photoURL, timeZone,
      lastLogin: serverTimestamp(),
    }, {merge: true});
    if (result.serverAuthCode) {
      try {
        await connectGoogleCalendar(result.serverAuthCode);
        const choices = await getCalendarChoices();
        setCalendarOptions(choices.calendars);
        setSelectedCalendarIds(choices.selectedCalendarIds);
        setMessage("Akun dan Google Calendar terhubung.");
      } catch (error) {
        setMessage(`Login berhasil, tetapi kalender belum terhubung: ${
          error instanceof Error ? error.message : "coba lagi di Settings."}`);
      }
    } else {
      setMessage("Login berhasil. Sambungan Google Calendar belum tersedia.");
    }
    await loadData(result.user.uid);
  });

  const logout = () => run(signOutGoogle);
  const refresh = () => run(async () => {
    if (!user) return;
    await loadData(user.uid);
    setMessage("Data diperbarui.");
  });
  const saveSchedule = (input: ManualScheduleInput) => run(async () => {
    if (!user) return;
    await createManualSchedule(user.uid, input);
    await loadData(user.uid);
    setMessage("Acara tetap berhasil disimpan.");
  });
  const saveTask = (input: NewTaskInput) => run(async () => {
    if (!user) return;
    await createTask(user.uid, input);
    await loadData(user.uid);
    setMessage("Tugas berhasil disimpan.");
  });
  const syncCalendar = async () => {
    setSyncStatus("running");
    const success = await run(async () => {
      if (!user) throw new Error("Masuk terlebih dahulu.");
      const result = await requestCalendarSync();
      await loadData(user.uid);
      setLastSyncedAt(new Date());
      setMessage(`Sinkronisasi selesai: ${result.imported} baru, ${result.updated} diperbarui, ` +
        `${result.unchanged} tetap, ${result.cancelled} dibatalkan.`);
    });
    setSyncStatus(success ? "success" : "error");
    return success;
  };
  const loadCalendars = () => run(async () => {
    const choices = await getCalendarChoices();
    setCalendarOptions(choices.calendars);
    setSelectedCalendarIds(choices.selectedCalendarIds);
    setMessage("Pilihan kalender berhasil dimuat.");
  });
  const toggleCalendar = (calendarId: string) => run(async () => {
    const next = selectedCalendarIds.includes(calendarId) ?
      selectedCalendarIds.filter((id) => id !== calendarId) :
      [...selectedCalendarIds, calendarId];
    await setCalendarChoices(next);
    setSelectedCalendarIds(next);
    setMessage("Pilihan kalender tersimpan.");
  });
  const sendSchedule = (schedule: SavedSchedule) => run(async () => {
    if (!user) return;
    const calendarId = selectedCalendarIds[0];
    if (!calendarId) throw new Error("Pilih kalender tujuan di Settings dahulu.");
    await publishManualSchedule(schedule.id, schedule, calendarId);
    await loadData(user.uid);
    setMessage("Acara berhasil dikirim ke Google Calendar.");
  });
  const previewScheduling = () => run(async () => {
    const result = await previewTaskScheduling();
    setProposal(result);
    setMessage(result.allocations.length ?
      "Tinjau usulan sebelum menyetujuinya." : "Tidak ada tugas yang perlu dijadwalkan.");
  });
  const confirmScheduling = () => run(async () => {
    if (!user || !proposal?.proposalId) return;
    const result = await applyTaskScheduling(proposal.proposalId);
    setLastAppliedProposalId(proposal.proposalId);
    setProposal(null);
    await loadData(user.uid);
    setMessage(`${result.scheduled} tugas terjadwal, ${result.unscheduled} belum mendapat slot.`);
  });
  const undoScheduling = () => run(async () => {
    if (!user || !lastAppliedProposalId) return;
    await undoTaskScheduling(lastAppliedProposalId);
    setLastAppliedProposalId(null);
    await loadData(user.uid);
    setMessage("Penjadwalan terakhir berhasil dibatalkan.");
  });

  return <CalendarContext.Provider value={{
    user, authReady, busy, message, schedules, tasks, proposal,
    canUndo: Boolean(lastAppliedProposalId), calendarOptions,
    selectedCalendarIds, lastSyncedAt, syncStatus, login, logout, refresh,
    saveSchedule, saveTask, syncCalendar, loadCalendars, toggleCalendar,
    sendSchedule, previewScheduling, confirmScheduling,
    dismissProposal: () => setProposal(null), undoScheduling,
  }}>{children}</CalendarContext.Provider>;
}
