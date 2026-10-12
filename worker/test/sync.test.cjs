const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');

const source = esbuild.buildSync({
  entryPoints: ['src/google.ts'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
}).outputFiles[0].text;
const modulePromise = import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const originalFetch = globalThis.fetch;

afterEach(() => { globalThis.fetch = originalFetch; });

test('full sync follows pages and returns token only after the last page', async () => {
  const { listEventsForSync } = await modulePromise;
  const requests = [];
  globalThis.fetch = async (input) => {
    const url = new URL(input);
    requests.push(url);
    if (!url.searchParams.has('pageToken')) {
      return Response.json({
        items: [{ id: 'first', summary: 'Class', start: { dateTime: '2026-10-07T09:00:00+07:00' }, end: { dateTime: '2026-10-07T10:00:00+07:00' } }],
        nextPageToken: 'page-2', timeZone: 'Asia/Jakarta',
      });
    }
    return Response.json({ items: [], nextSyncToken: 'new-token', timeZone: 'Asia/Jakarta' });
  };
  const result = await listEventsForSync('access', 'primary', '2026-10-01T00:00:00Z', '2027-01-01T00:00:00Z', 'Asia/Jakarta', null);
  assert.equal(result.events.length, 1);
  assert.equal(result.nextSyncToken, 'new-token');
  assert.equal(result.mode, 'full');
  assert.equal(requests.length, 2);
  assert.equal(requests[0].searchParams.get('timeMin'), '2026-10-01T00:00:00Z');
  assert.equal(requests[0].searchParams.get('showDeleted'), 'true');
  assert.equal(requests[1].searchParams.get('pageToken'), 'page-2');
});

test('incremental sync omits time filters and returns cancelled event IDs', async () => {
  const { listEventsForSync, mapGoogleEvent } = await modulePromise;
  const expected = await mapGoogleEvent({ id: 'removed', start: { dateTime: '2026-10-07T09:00:00+07:00' }, end: { dateTime: '2026-10-07T10:00:00+07:00' } }, 'primary', 'Asia/Jakarta');
  let requestUrl;
  globalThis.fetch = async (input) => {
    requestUrl = new URL(input);
    return Response.json({ items: [{ id: 'removed', status: 'cancelled' }], nextSyncToken: 'next-token' });
  };
  const result = await listEventsForSync('access', 'primary', 'ignored-min', 'ignored-max', 'Asia/Jakarta', 'old-token');
  assert.deepEqual(result.cancelledIds, [expected.id]);
  assert.equal(result.mode, 'incremental');
  assert.equal(requestUrl.searchParams.get('syncToken'), 'old-token');
  assert.equal(requestUrl.searchParams.has('timeMin'), false);
  assert.equal(requestUrl.searchParams.has('timeMax'), false);
  assert.equal(requestUrl.searchParams.has('orderBy'), false);
});

test('expired sync token remains distinguishable for full resync', async () => {
  const { listEventsForSync } = await modulePromise;
  globalThis.fetch = async () => new Response('{}', { status: 410 });
  await assert.rejects(
    listEventsForSync('access', 'primary', 'ignored-min', 'ignored-max', 'Asia/Jakarta', 'old-token'),
    (error) => error.status === 410,
  );
});
