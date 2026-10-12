import {DateTime} from "luxon";
import {Text, View} from "react-native";
import {ActionButton, Card, ScreenShell, TaskForm, calendarStyles} from
  "../../components/calendar-ui";
import {useCalendar} from "../../contexts/CalendarContext";

export default function TasksScreen() {
  const {user, tasks, proposal, canUndo, busy, previewScheduling,
    confirmScheduling, dismissProposal, undoScheduling} = useCalendar();
  const ordered = [...tasks].sort((a, b) =>
    a.deadline.toMillis() - b.deadline.toMillis());
  return <ScreenShell title="Tasks" subtitle="Tugas tetap terlihat meski belum punya sesi.">
    {user && <>
      <TaskForm />
      <Card title="Rencana tugas">
        <Text style={calendarStyles.muted}>
          Usulan tidak mengubah jadwal sampai kamu memilih Setujui.
        </Text>
        <ActionButton title="Lihat usulan jadwal" disabled={busy}
          onPress={() => void previewScheduling()} />
        {canUndo && <ActionButton secondary title="Batalkan penjadwalan terakhir"
          disabled={busy} onPress={() => void undoScheduling()} />}
      </Card>
      {proposal && proposal.allocations.length > 0 && <Card title="Usulan penjadwalan">
        {proposal.allocations.map((item) => <Text key={item.taskId}>
          {item.taskTitle} · {item.startMs === null ? "Belum mendapat slot" :
            `${new Date(item.startMs).toLocaleString("id-ID")}–${
              new Date(item.endMs!).toLocaleString("id-ID")}`}
        </Text>)}
        <ActionButton title="Setujui dan simpan" disabled={busy}
          onPress={() => void confirmScheduling()} />
        <ActionButton secondary title="Abaikan usulan" onPress={dismissProposal} />
      </Card>}
      <Card title={`Daftar tugas (${ordered.length})`}>
        {ordered.length === 0 && <Text style={calendarStyles.muted}>Belum ada tugas.</Text>}
        {ordered.map((task) => <View key={task.id}>
          <Text style={{fontWeight: "700", color: "#17253e"}}>{task.title}</Text>
          <Text style={calendarStyles.muted}>
            {task.status} · Deadline {DateTime.fromJSDate(task.deadline.toDate())
              .setLocale("id").toFormat("d LLL yyyy, HH:mm")}
          </Text>
          {task.scheduledStartTime && <Text style={calendarStyles.muted}>
            Sesi: {task.scheduledStartTime.toDate().toLocaleString("id-ID")}
          </Text>}
        </View>)}
      </Card>
    </>}
  </ScreenShell>;
}
