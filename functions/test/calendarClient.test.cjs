const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createGoogleScheduleId,
  mapGoogleEvent,
} = require("../lib/google/calendarClient.js");

test("uses a stable document ID for the same Google event", () => {
  const first = createGoogleScheduleId("primary", "event-123");
  assert.equal(first, createGoogleScheduleId("primary", "event-123"));
  assert.notEqual(first, createGoogleScheduleId("other", "event-123"));
});

test("keeps the exclusive end date of an all-day event", () => {
  const result = mapGoogleEvent(
    {
      id: "all-day",
      start: {date: "2026-10-06"},
      end: {date: "2026-10-07"},
    },
    "primary",
    "Asia/Jakarta"
  );

  assert.equal(result.allDay, true);
  assert.equal(result.startMs, Date.parse("2026-10-06T00:00:00+07:00"));
  assert.equal(result.endMs, Date.parse("2026-10-07T00:00:00+07:00"));
});

test("maps a timed event with its timezone offset", () => {
  const result = mapGoogleEvent(
    {
      id: "meeting",
      summary: "Rapat",
      start: {dateTime: "2026-10-06T10:00:00+07:00"},
      end: {dateTime: "2026-10-06T11:00:00+07:00"},
    },
    "primary",
    "Asia/Jakarta"
  );

  assert.equal(result.title, "Rapat");
  assert.equal(result.allDay, false);
  assert.equal(result.startMs, Date.parse("2026-10-06T10:00:00+07:00"));
  assert.equal(result.endMs, Date.parse("2026-10-06T11:00:00+07:00"));
});
