import {DateTime} from "luxon";
import {useMemo, useState} from "react";
import {Pressable, StyleSheet, Text, View} from "react-native";
import {ActionButton, Card, ScheduleForm, ScreenShell, TimelineList,
  calendarStyles} from "../../components/calendar-ui";
import {useCalendar} from "../../contexts/CalendarContext";
import {buildDayTimeline, weekDays} from "../../services/timeline";

export default function WeekScreen() {
  const {user, schedules, tasks, selectedCalendarIds, busy,
    refresh, sendSchedule} = useCalendar();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jakarta";
  const [selectedDay, setSelectedDay] = useState(() =>
    DateTime.now().setZone(timeZone).toISODate()!);
  const days = weekDays(selectedDay, timeZone);
  const allSchedules = useMemo(() => schedules.map((item) => ({
    id: item.id, title: item.title, startMs: item.startTime.toMillis(),
    endMs: item.endTime.toMillis(), status: item.status, source: item.source,
    googleCalendarId: item.googleCalendarId,
  })), [schedules]);
  const allTasks = useMemo(() => tasks.map((item) => ({
    id: item.id, title: item.title,
    startMs: item.scheduledStartTime?.toMillis() ?? null,
    endMs: item.scheduledEndTime?.toMillis() ?? null, status: item.status,
  })), [tasks]);
  const entries = buildDayTimeline(selectedDay, timeZone, allSchedules,
    allTasks, selectedCalendarIds);
  const shiftWeek = (daysToAdd: number) => setSelectedDay(
    DateTime.fromISO(selectedDay, {zone: timeZone}).plus({days: daysToAdd}).toISODate()!);
  return <ScreenShell title="Week" subtitle="Pilih hari untuk melihat waktu dan komitmennya.">
    {user && <>
      {selectedCalendarIds.length === 0 && <Card>
        <Text style={calendarStyles.muted}>
          Kalender Google belum dipilih atau belum dimuat. Waktu luang mungkin belum lengkap.
        </Text>
      </Card>}
      <Card title={`${DateTime.fromISO(days[0], {zone: timeZone}).setLocale("id").toFormat("d LLL")} – ${
        DateTime.fromISO(days[6], {zone: timeZone}).setLocale("id").toFormat("d LLL yyyy")}`}>
        <View style={calendarStyles.row}>
          <View style={calendarStyles.rowItem}><ActionButton secondary title="Pekan lalu"
            onPress={() => shiftWeek(-7)} /></View>
          <View style={calendarStyles.rowItem}><ActionButton secondary title="Pekan depan"
            onPress={() => shiftWeek(7)} /></View>
        </View>
        <View style={styles.days}>
          {days.map((date) => {
            const count = buildDayTimeline(date, timeZone, allSchedules,
              allTasks, selectedCalendarIds).filter((item) => item.kind !== "free").length;
            return <Pressable key={date} accessibilityRole="button"
              accessibilityLabel={`${date}, ${count} komitmen`}
              onPress={() => setSelectedDay(date)}
              style={[styles.day, date === selectedDay && styles.selectedDay]}>
              <Text style={[styles.dayText, date === selectedDay && styles.selectedText]}>
                {DateTime.fromISO(date, {zone: timeZone}).setLocale("id").toFormat("ccc")}
              </Text>
              <Text style={[styles.dayNumber, date === selectedDay && styles.selectedText]}>
                {DateTime.fromISO(date, {zone: timeZone}).day}
              </Text>
              <Text style={[styles.count, date === selectedDay && styles.selectedText]}>{count}</Text>
            </Pressable>;
          })}
        </View>
      </Card>
      <Card title={DateTime.fromISO(selectedDay, {zone: timeZone})
        .setLocale("id").toFormat("cccc, d LLLL")}>
        <ActionButton secondary title="Muat ulang data" disabled={busy}
          onPress={() => void refresh()} />
        <TimelineList entries={entries} timeZone={timeZone} schedules={schedules}
          onSendSchedule={(schedule) => void sendSchedule(schedule)} />
      </Card>
      <ScheduleForm />
    </>}
  </ScreenShell>;
}

const styles = StyleSheet.create({
  days: {flexDirection: "row", gap: 3},
  day: {flex: 1, alignItems: "center", borderRadius: 8,
    paddingVertical: 7, backgroundColor: "#edf2f8"},
  selectedDay: {backgroundColor: "#2358bd"},
  dayText: {fontSize: 11, color: "#475569"},
  dayNumber: {fontSize: 16, fontWeight: "700", color: "#17253e"},
  count: {fontSize: 11, color: "#475569"},
  selectedText: {color: "white"},
});
