import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDayTimeline, weekDays } from '../services/timeline.ts';

const ms = (value) => Date.parse(value);

test('Today orders fixed events, task sessions, and free time', () => {
  const entries = buildDayTimeline('2026-10-07', 'Asia/Jakarta', [
    { id: 'class', title: 'Kelas', startMs: ms('2026-10-07T09:00:00+07:00'),
      endMs: ms('2026-10-07T10:00:00+07:00'), status: 'confirmed',
      source: 'manual', googleCalendarId: null },
  ], [
    { id: 'essay', title: 'Esai', startMs: ms('2026-10-07T10:30:00+07:00'),
      endMs: ms('2026-10-07T11:30:00+07:00'), status: 'scheduled' },
  ], []);
  assert.deepEqual(entries.map((item) => [item.kind, item.title]), [
    ['free', 'Waktu luang'], ['schedule', 'Kelas'],
    ['free', 'Waktu luang'], ['task', 'Esai'], ['free', 'Waktu luang'],
  ]);
  assert.equal(entries[0].startMs, ms('2026-10-07T08:00:00+07:00'));
  assert.equal(entries[0].endMs, ms('2026-10-07T09:00:00+07:00'));
});

test('Today flags both overlapping commitments', () => {
  const entries = buildDayTimeline('2026-10-07', 'Asia/Jakarta', [
    { id: 'class', title: 'Kelas', startMs: ms('2026-10-07T09:00:00+07:00'),
      endMs: ms('2026-10-07T10:00:00+07:00'), status: 'confirmed',
      source: 'manual', googleCalendarId: null },
  ], [
    { id: 'essay', title: 'Esai', startMs: ms('2026-10-07T09:30:00+07:00'),
      endMs: ms('2026-10-07T10:30:00+07:00'), status: 'scheduled' },
  ], []);
  assert.deepEqual(entries.filter((item) => item.conflict).map((item) => item.id),
    ['class', 'essay']);
});

test('Today excludes cancelled and unselected Google events', () => {
  const entries = buildDayTimeline('2026-10-07', 'Asia/Jakarta', [
    { id: 'hidden', title: 'Kalender lain', startMs: ms('2026-10-07T09:00:00+07:00'),
      endMs: ms('2026-10-07T10:00:00+07:00'), status: 'confirmed',
      source: 'google', googleCalendarId: 'other' },
    { id: 'cancelled', title: 'Batal', startMs: ms('2026-10-07T11:00:00+07:00'),
      endMs: ms('2026-10-07T12:00:00+07:00'), status: 'cancelled',
      source: 'manual', googleCalendarId: null },
  ], [], ['primary']);
  assert.deepEqual(entries.map((item) => item.kind), ['free']);
});

test('Week starts Monday and spans seven dates across month boundary', () => {
  assert.deepEqual(weekDays('2026-10-01', 'Asia/Jakarta'), [
    '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01',
    '2026-10-02', '2026-10-03', '2026-10-04',
  ]);
});
