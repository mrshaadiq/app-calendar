import {DateTime} from "luxon";
import {useMemo} from "react";
import {Text} from "react-native";
import {ActionButton, Card, ScheduleForm, ScreenShell, TimelineList,
  calendarStyles} from "../../components/calendar-ui";
import {useCalendar} from "../../contexts/CalendarContext";
import {buildDayTimeline} from "../../services/timeline";

export default function TodayScreen() {
  const {user, schedules, tasks, selectedCalendarIds, busy,
    refresh, sendSchedule} = useCalendar();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jakarta";
  const dateISO = DateTime.now().setZone(timeZone).toISODate()!;
  const entries = useMemo(() => buildDayTimeline(dateISO, timeZone,
    schedules.map((item) => ({id: item.id, title: item.title,
      startMs: item.startTime.toMillis(), endMs: item.endTime.toMillis(),
      status: item.status, source: item.source,
      googleCalendarId: item.googleCalendarId})),
    tasks.map((item) => ({id: item.id, title: item.title,
      startMs: item.scheduledStartTime?.toMillis() ?? null,
      endMs: item.scheduledEndTime?.toMillis() ?? null,
      status: item.status})), selectedCalendarIds),
  [dateISO, timeZone, schedules, tasks, selectedCalendarIds]);
  const dateLabel = DateTime.fromISO(dateISO, {zone: timeZone})
    .setLocale("id").toFormat("cccc, d LLLL yyyy");
  return <ScreenShell title="Today" subtitle={dateLabel}>
    {user && <>
      {selectedCalendarIds.length === 0 && <Card>
        <Text style={calendarStyles.muted}>
          Kalender Google belum dipilih atau belum dimuat. Waktu luang mungkin belum lengkap.
        </Text>
      </Card>}
      <Card title="Hari ini">
        <Text style={calendarStyles.muted}>
          Acara tetap, sesi tugas, dan waktu luang ditampilkan dalam urutan waktu.
        </Text>
        <ActionButton secondary title="Muat ulang data" disabled={busy}
          onPress={() => void refresh()} />
        <TimelineList entries={entries} timeZone={timeZone} schedules={schedules}
          onSendSchedule={(schedule) => void sendSchedule(schedule)} />
      </Card>
      <ScheduleForm />
    </>}
  </ScreenShell>;
}
