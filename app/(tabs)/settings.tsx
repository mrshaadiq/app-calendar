import {Platform, Text} from "react-native";
import {ActionButton, Card, ScreenShell, calendarStyles} from
  "../../components/calendar-ui";
import {useCalendar} from "../../contexts/CalendarContext";

export default function SettingsScreen() {
  const {user, busy, calendarOptions, selectedCalendarIds, lastSyncedAt, syncStatus,
    loadCalendars, toggleCalendar, syncCalendar, logout} = useCalendar();
  return <ScreenShell title="Settings" subtitle="Akun dan kalender yang digunakan aplikasi.">
    {user && <>
      <Card title="Akun">
        <Text>{user.displayName || user.email}</Text>
        <ActionButton secondary title="Keluar" disabled={busy}
          onPress={() => void logout()} />
      </Card>
      <Card title="Google Calendar">
        <Text style={calendarStyles.muted}>
          Pilih kalender yang dibaca. Acara baru dikirim ke kalender terpilih pertama.
        </Text>
        <Text style={calendarStyles.muted}>Sinkronisasi terakhir sesi ini: {
          lastSyncedAt ? lastSyncedAt.toLocaleString("id-ID") : "belum ada"}</Text>
        <Text style={calendarStyles.muted}>Status: {{
          idle: "belum dijalankan", running: "sedang berjalan",
          success: "berhasil", error: "gagal — coba lagi",
        }[syncStatus]}</Text>
        {Platform.OS !== "web" && <>
          <ActionButton secondary title="Muat pilihan kalender" disabled={busy}
            onPress={() => void loadCalendars()} />
          <ActionButton title="Sinkronkan sekarang" disabled={busy}
            onPress={() => void syncCalendar()} />
        </>}
        {calendarOptions.length === 0 && <Text style={calendarStyles.muted}>
          Pilihan kalender belum dimuat atau sambungan Google belum tersedia.
        </Text>}
        {calendarOptions.map((calendar) => <ActionButton secondary key={calendar.id}
          title={`${selectedCalendarIds.includes(calendar.id) ? "✓" : "○"} ${calendar.summary}`}
          disabled={busy} onPress={() => void toggleCalendar(calendar.id)} />)}
      </Card>
    </>}
  </ScreenShell>;
}
