const test = require("node:test");
const assert = require("node:assert/strict");
const { scheduleTasks } = require("../lib/scheduler/scheduleTask.js");

const at = (time) => Date.parse(`2026-10-06T${time}:00+07:00`);

test("places a task after a mandatory schedule", () => {
  const result = scheduleTasks(
    [{ id: "task-1", deadlineMs: at("12:00"), durationMinutes: 60 }],
    [{ startMs: at("08:00"), endMs: at("09:00") }],
    at("08:00"),
    "Asia/Jakarta"
  );

  assert.deepEqual(result[0], {
    taskId: "task-1",
    startMs: at("09:00"),
    endMs: at("10:00"),
    status: "scheduled",
  });
});

test("does not overlap two newly scheduled tasks", () => {
  const result = scheduleTasks(
    [
      { id: "first", deadlineMs: at("12:00"), durationMinutes: 60 },
      { id: "second", deadlineMs: at("12:00"), durationMinutes: 60 },
    ],
    [],
    at("08:00"),
    "Asia/Jakarta"
  );

  assert.equal(result[0].startMs, at("08:00"));
  assert.equal(result[1].startMs, at("09:00"));
});

test("reports an unavailable slot before the deadline", () => {
  const result = scheduleTasks(
    [{ id: "late", deadlineMs: at("08:30"), durationMinutes: 60 }],
    [],
    at("08:00"),
    "Asia/Jakarta"
  );

  assert.deepEqual(result[0], {
    taskId: "late",
    startMs: null,
    endMs: null,
    status: "unscheduled",
    reason: "no_available_slot",
  });
});

test("rounds the next start to a 15 minute boundary", () => {
  const result = scheduleTasks(
    [{ id: "rounded", deadlineMs: at("12:00"), durationMinutes: 30 }],
    [],
    at("08:07"),
    "Asia/Jakarta"
  );

  assert.equal(result[0].startMs, at("08:15"));
});
