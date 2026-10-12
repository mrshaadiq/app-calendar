const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { readFileSync } = require('node:fs');
const esbuild = require('esbuild');

const source = esbuild.buildSync({
  entryPoints: ['src/store.ts'], bundle: true, write: false,
  format: 'esm', platform: 'neutral', target: 'es2022',
}).outputFiles[0].text;
const modulePromise = import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function d1InMemory() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync('migrations/0001_initial.sql', 'utf8'));
  sqlite.exec(readFileSync('migrations/0002_sync_checkpoint.sql', 'utf8'));
  return {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      return {
        bind(...values) {
          return {
            async first() { return statement.get(...values) || null; },
            async run() {
              const result = statement.run(...values);
              return { meta: { changes: Number(result.changes) } };
            },
          };
        },
      };
    },
  };
}

test('checkpoint advances only after ack and rejects a stale ack', async () => {
  const { getCalendarSyncState, stageCalendarSyncToken, acknowledgeCalendarSyncToken } = await modulePromise;
  const env = { DB: d1InMemory() };
  await stageCalendarSyncToken(env, 'uid', 'primary', 'token-1', 10, 20);
  assert.equal((await getCalendarSyncState(env, 'uid', 'primary')).sync_token, null);
  await acknowledgeCalendarSyncToken(env, 'uid', 'primary', 'token-1');
  assert.equal((await getCalendarSyncState(env, 'uid', 'primary')).sync_token, 'token-1');
  await stageCalendarSyncToken(env, 'uid', 'primary', 'token-2', 30, 40);
  await assert.rejects(
    acknowledgeCalendarSyncToken(env, 'uid', 'primary', 'token-1'),
    (error) => error.status === 409,
  );
  assert.equal((await getCalendarSyncState(env, 'uid', 'primary')).sync_token, 'token-1');
  await acknowledgeCalendarSyncToken(env, 'uid', 'primary', 'token-2');
  assert.deepEqual({ ...await getCalendarSyncState(env, 'uid', 'primary') }, {
    sync_token: 'token-2', window_start_ms: 30, window_end_ms: 40,
  });
});
