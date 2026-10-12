import {DateTime} from "luxon";
import {useState, type ReactNode} from "react";
import {ActivityIndicator, Pressable, ScrollView, StyleSheet, Text,
  TextInput, View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {useCalendar, type SavedSchedule} from "../contexts/CalendarContext";
import type {TimelineEntry} from "../services/timeline";

export function ActionButton({title, onPress, disabled = false, secondary = false}: {
  title: string; onPress: () => void; disabled?: boolean; secondary?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title}
    disabled={disabled} onPress={onPress}
    style={[styles.button, secondary && styles.secondaryButton,
      disabled && styles.disabled]}>
    <Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>{title}</Text>
  </Pressable>;
}

export function Card({title, children}: {title?: string; children: ReactNode}) {
  return <View style={styles.card}>
    {title && <Text style={styles.cardTitle}>{title}</Text>}
    {children}
  </View>;
}

export function ScreenShell({title, subtitle, children}: {
  title: string; subtitle?: string; children: ReactNode;
}) {
  const {authReady, user, busy, message, login} = useCalendar();
  if (!authReady) {
    return <SafeAreaView style={styles.center}><ActivityIndicator /></SafeAreaView>;
  }
  return <SafeAreaView style={styles.container}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {!user ? <Card title="Mulai">
        <Text>Masuk dengan Google untuk melihat jadwal dan tugasmu.</Text>
        <ActionButton title="Masuk dengan Google" onPress={() => void login()} disabled={busy} />
      </Card> : children}
      {busy && <ActivityIndicator accessibilityLabel="Sedang memproses" />}
      {!!message && <Text accessibilityRole="alert" style={styles.message}>{message}</Text>}
    </ScrollView>
  </SafeAreaView>;
}

export function TimelineList({entries, timeZone, schedules = [], onSendSchedule}: {
  entries: TimelineEntry[]; timeZone: string; schedules?: SavedSchedule[];
  onSendSchedule?: (schedule: SavedSchedule) => void;
}) {
  const {busy} = useCalendar();
  const byId = new Map(schedules.map((item) => [item.id, item]));
  if (entries.length === 0) return <Text style={styles.muted}>Belum ada aktivitas.</Text>;
  return <View style={styles.timeline}>
    {entries.map((entry) => {
      const schedule = entry.kind === "schedule" ? byId.get(entry.id) : undefined;
      const label = entry.kind === "free" ? "Waktu luang" :
        entry.kind === "task" ? "Sesi tugas" :
        entry.source === "google" ? "Acara Google" : "Acara tetap";
      const start = DateTime.fromMillis(entry.startMs, {zone: timeZone}).toFormat("HH:mm");
      const end = DateTime.fromMillis(entry.endMs, {zone: timeZone}).toFormat("HH:mm");
      return <View key={`${entry.kind}_${entry.id}`} style={[
        styles.timelineItem, entry.kind === "free" && styles.freeItem,
        entry.conflict && styles.conflictItem,
      ]}>
        <Text style={styles.time}>{start}–{end}</Text>
        <View style={styles.timelineBody}>
          <Text style={styles.itemTitle}>{entry.title}</Text>
          <Text style={styles.muted}>{label}{entry.conflict ? " · Bentrok" : ""}</Text>
          {schedule?.source === "manual" && onSendSchedule &&
            <ActionButton secondary disabled={busy}
              title={schedule.googleEventId ? "Perbarui di Google" : "Kirim ke Google"}
              onPress={() => onSendSchedule(schedule)} />}
        </View>
      </View>;
    })}
  </View>;
}

function parseDateTime(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) throw new Error("Gunakan format YYYY-MM-DD HH:mm.");
  const [, year, month, day, hour, minute] = match.map(Number);
  const date = new Date(year, month - 1, day, hour, minute);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 ||
      date.getDate() !== day || date.getHours() !== hour ||
      date.getMinutes() !== minute) throw new Error("Tanggal atau jam tidak valid.");
  return date;
}

export function ScheduleForm() {
  const {busy, saveSchedule} = useCalendar();
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState("");
  const save = async () => {
    setError("");
    try {
      const saved = await saveSchedule({title, startTime: parseDateTime(start),
        endTime: parseDateTime(end)});
      if (saved) { setTitle(""); setStart(""); setEnd(""); }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Tanggal tidak valid.");
    }
  };
  return <Card title="Tambah acara sekali">
    <TextInput style={styles.input} accessibilityLabel="Judul acara"
      placeholder="Judul acara" value={title} onChangeText={setTitle} />
    <TextInput style={styles.input} accessibilityLabel="Waktu mulai"
      placeholder="Mulai: YYYY-MM-DD HH:mm" value={start} onChangeText={setStart} />
    <TextInput style={styles.input} accessibilityLabel="Waktu selesai"
      placeholder="Selesai: YYYY-MM-DD HH:mm" value={end} onChangeText={setEnd} />
    <ActionButton title="Simpan acara" disabled={busy} onPress={() => void save()} />
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  </Card>;
}

export function TaskForm() {
  const {busy, saveTask} = useCalendar();
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [duration, setDuration] = useState("60");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [error, setError] = useState("");
  const save = async () => {
    setError("");
    try {
      const saved = await saveTask({title, deadline: parseDateTime(deadline),
        estimatedDurationMinutes: Number(duration)});
      if (saved) { setTitle(""); setDeadline(""); setDuration("60"); }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Deadline tidak valid.");
    }
  };
  return <Card title="Tambah tugas">
    <TextInput style={styles.input} accessibilityLabel="Judul tugas"
      placeholder="Judul tugas" value={title} onChangeText={setTitle} />
    <TextInput style={styles.input} accessibilityLabel="Deadline tugas"
      placeholder="Deadline: YYYY-MM-DD HH:mm" value={deadline}
      onChangeText={setDeadline} />
    <TextInput style={styles.input} accessibilityLabel="Durasi tugas dalam menit"
      placeholder="Durasi (menit)" value={duration} onChangeText={setDuration}
      keyboardType="numeric" />
    <ActionButton title="Simpan tugas" disabled={busy} onPress={() => void save()} />
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  </Card>;
}

export const calendarStyles = StyleSheet.create({
  muted: {color: "#64748b", lineHeight: 20},
  row: {flexDirection: "row", gap: 8},
  rowItem: {flex: 1},
});

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: "#f4f7fb"},
  center: {flex: 1, alignItems: "center", justifyContent: "center"},
  content: {padding: 20, gap: 16, paddingBottom: 36},
  heading: {fontSize: 30, fontWeight: "700", color: "#17253e"},
  subtitle: {color: "#58657b", lineHeight: 21},
  card: {backgroundColor: "white", borderRadius: 16, padding: 16, gap: 12},
  cardTitle: {fontSize: 19, fontWeight: "700", color: "#17253e"},
  button: {backgroundColor: "#2358bd", borderRadius: 10, padding: 13,
    alignItems: "center"},
  secondaryButton: {backgroundColor: "#e9f0ff"},
  disabled: {opacity: 0.5},
  buttonText: {color: "white", fontWeight: "700"},
  secondaryButtonText: {color: "#2358bd"},
  input: {borderWidth: 1, borderColor: "#d7dfe9", borderRadius: 10,
    padding: 12, color: "#17253e"},
  timeline: {gap: 8},
  timelineItem: {flexDirection: "row", gap: 10, borderLeftWidth: 4,
    borderLeftColor: "#2358bd", backgroundColor: "#f8fbff", borderRadius: 8,
    padding: 12},
  freeItem: {borderLeftColor: "#94a3b8", backgroundColor: "#f8fafc"},
  conflictItem: {borderLeftColor: "#d92d20", backgroundColor: "#fff1f0"},
  time: {minWidth: 86, color: "#334155", fontWeight: "600"},
  timelineBody: {flex: 1, gap: 5},
  itemTitle: {fontWeight: "700", color: "#17253e"},
  muted: {color: "#64748b", lineHeight: 20},
  message: {color: "#153b72", lineHeight: 21},
  error: {color: "#b42318"},
});
