const { test } = require('node:test');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');

const source = esbuild.buildSync({
  entryPoints: ['../services/calendarSyncPlan.ts'], bundle: true, write: false,
  format: 'esm', platform: 'neutral', target: 'es2022',
}).outputFiles[0].text;
const modulePromise = import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

const old = (calendarId, startMs = 100, status = 'confirmed') => ({
  source: 'google', status, title: 'Old', startMs, endMs: startMs + 60,
  googleEventId: 'event-1', googleCalendarId: calendarId,
  allDay: false, timeZone: 'Asia/Jakarta', recurrence: null, etag: 'old',
});

test('full sync cancels only missing events in that calendar and window', async () => {
  const { planCalendarSync } = await modulePromise;
  const existing = new Map([
    ['inside', old('primary')], ['other', old('secondary')],
    ['outside', old('primary', 500)],
  ]);
  const result = planCalendarSync(existing, {
    calendarId: 'primary', mode: 'full', events: [], cancelledIds: [], nextSyncToken: 'next',
  }, 0, 300);
  assert.deepEqual(result.writes, [{ id: 'inside', kind: 'cancel' }]);
  assert.equal(result.summary.cancelled, 1);
});

test('incremental sync keeps unmentioned events and applies explicit cancellation', async () => {
  const { planCalendarSync } = await modulePromise;
  const existing = new Map([['removed', old('primary')], ['untouched', old('primary')]]);
  const result = planCalendarSync(existing, {
    calendarId: 'primary', mode: 'incremental', events: [], cancelledIds: ['removed'], nextSyncToken: 'next',
  }, 0, 300);
  assert.deepEqual(result.writes, [{ id: 'removed', kind: 'cancel' }]);
  assert.equal(result.summary.cancelled, 1);
});

test('changed Google event updates the same document instead of importing another', async () => {
  const { planCalendarSync } = await modulePromise;
  const existing = new Map([['stable-id', old('primary')]]);
  const result = planCalendarSync(existing, {
    calendarId: 'primary', mode: 'incremental', cancelledIds: [], nextSyncToken: 'next',
    events: [{ id: 'stable-id', googleEventId: 'event-1', googleCalendarId: 'primary',
      title: 'New', startMs: 100, endMs: 160, allDay: false, timeZone: 'Asia/Jakarta',
      recurrence: null, recurringEventId: null, originalStartTime: null, etag: 'new', appScheduleId: null }],
  }, 0, 300);
  assert.equal(result.writes.length, 1);
  assert.equal(result.writes[0].id, 'stable-id');
  assert.equal(result.writes[0].kind, 'upsert');
  assert.equal(result.summary.updated, 1);
  assert.equal(result.summary.imported, 0);
});
