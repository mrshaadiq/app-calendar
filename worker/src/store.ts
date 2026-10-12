import {decryptRefreshToken, encryptRefreshToken} from "./crypto";
import {ApiError, type Env, type GoogleConnectionRow, type GoogleEventLinkRow} from "./types";

export async function getConnection(env: Env, uid: string): Promise<GoogleConnectionRow> {
  const row = await env.DB.prepare(
    "SELECT * FROM google_connections WHERE uid = ?"
  ).bind(uid).first<GoogleConnectionRow>();
  if (!row) throw new ApiError(409, "Hubungkan Google Calendar terlebih dahulu.");
  return row;
}

export async function getRefreshToken(env: Env, uid: string): Promise<string> {
  const row = await getConnection(env, uid);
  return decryptRefreshToken(
    row.refresh_token_ciphertext,
    row.refresh_token_iv,
    uid,
    env.TOKEN_ENCRYPTION_KEY
  );
}

export async function saveConnection(
  env: Env,
  uid: string,
  accountId: string,
  refreshToken: string,
  scopes: string
): Promise<void> {
  const encrypted = await encryptRefreshToken(
    refreshToken,
    uid,
    env.TOKEN_ENCRYPTION_KEY
  );
  const now = new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO google_connections
      (uid, google_account_id, refresh_token_ciphertext, refresh_token_iv,
       granted_scopes, connected_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(uid) DO UPDATE SET
      google_account_id=excluded.google_account_id,
      refresh_token_ciphertext=excluded.refresh_token_ciphertext,
      refresh_token_iv=excluded.refresh_token_iv,
      granted_scopes=excluded.granted_scopes,
      updated_at=excluded.updated_at
  `).bind(uid, accountId, encrypted.ciphertext, encrypted.iv,
    scopes, now, now).run();
}

export async function getSelectedCalendars(env: Env, uid: string): Promise<string[]> {
  const result = await env.DB.prepare(
    "SELECT calendar_id FROM selected_calendars WHERE uid = ?"
  ).bind(uid).all<{calendar_id: string}>();
  return result.results.map((row) => row.calendar_id);
}

export async function saveSelectedCalendars(
  env: Env,
  uid: string,
  calendarIds: string[]
): Promise<void> {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM selected_calendars WHERE uid = ?").bind(uid),
    ...calendarIds.map((id) => env.DB.prepare(
      "INSERT INTO selected_calendars (uid, calendar_id) VALUES (?, ?)"
    ).bind(uid, id)),
  ]);
}

export interface CalendarSyncState {
  sync_token: string | null;
  window_start_ms: number | null;
  window_end_ms: number | null;
}

export async function getCalendarSyncState(
  env: Env, uid: string, calendarId: string
): Promise<CalendarSyncState | null> {
  return env.DB.prepare(`
    SELECT sync_token, window_start_ms, window_end_ms
    FROM calendar_sync_state WHERE uid = ? AND calendar_id = ?
  `).bind(uid, calendarId).first<CalendarSyncState>();
}

export async function stageCalendarSyncToken(
  env: Env, uid: string, calendarId: string, token: string,
  windowStartMs: number, windowEndMs: number
): Promise<void> {
  await env.DB.prepare(`
    INSERT INTO calendar_sync_state
      (uid, calendar_id, sync_token, updated_at, pending_sync_token,
       pending_window_start_ms, pending_window_end_ms)
    VALUES (?, ?, NULL, ?, ?, ?, ?)
    ON CONFLICT(uid, calendar_id) DO UPDATE SET
      pending_sync_token = excluded.pending_sync_token,
      pending_window_start_ms = excluded.pending_window_start_ms,
      pending_window_end_ms = excluded.pending_window_end_ms
  `).bind(uid, calendarId, new Date().toISOString(), token,
    windowStartMs, windowEndMs).run();
}

export async function acknowledgeCalendarSyncToken(
  env: Env, uid: string, calendarId: string, token: string
): Promise<void> {
  const result = await env.DB.prepare(`
    UPDATE calendar_sync_state SET
      sync_token = pending_sync_token,
      window_start_ms = pending_window_start_ms,
      window_end_ms = pending_window_end_ms,
      pending_sync_token = NULL,
      pending_window_start_ms = NULL,
      pending_window_end_ms = NULL,
      updated_at = ?
    WHERE uid = ? AND calendar_id = ? AND pending_sync_token = ?
  `).bind(new Date().toISOString(), uid, calendarId, token).run();
  if (result.meta.changes !== 1) {
    throw new ApiError(409, "Hasil sinkronisasi berubah. Jalankan sinkronisasi ulang.");
  }
}

export async function getEventLink(
  env: Env,
  uid: string,
  appScheduleId: string
): Promise<GoogleEventLinkRow | null> {
  return env.DB.prepare(
    "SELECT * FROM google_event_links WHERE uid = ? AND app_schedule_id = ?"
  ).bind(uid, appScheduleId).first<GoogleEventLinkRow>();
}

export async function saveEventLink(
  env: Env,
  uid: string,
  appScheduleId: string,
  calendarId: string,
  googleEventId: string,
  etag: string | null
): Promise<void> {
  await env.DB.prepare(`
    INSERT INTO google_event_links
      (uid, app_schedule_id, calendar_id, google_event_id, etag, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(uid, app_schedule_id) DO UPDATE SET
      calendar_id=excluded.calendar_id,
      google_event_id=excluded.google_event_id,
      etag=excluded.etag,
      updated_at=excluded.updated_at
  `).bind(uid, appScheduleId, calendarId, googleEventId, etag,
    new Date().toISOString()).run();
}

export async function deleteEventLink(
  env: Env,
  uid: string,
  appScheduleId: string
): Promise<void> {
  await env.DB.prepare(
    "DELETE FROM google_event_links WHERE uid = ? AND app_schedule_id = ?"
  ).bind(uid, appScheduleId).run();
}

export async function getIdempotentResult(
  env: Env,
  uid: string,
  key: string
): Promise<unknown | null> {
  const row = await env.DB.prepare(
    "SELECT response_json FROM idempotency_results WHERE uid = ? AND idempotency_key = ?"
  ).bind(uid, key).first<{response_json: string}>();
  return row ? JSON.parse(row.response_json) : null;
}

export async function saveIdempotentResult(
  env: Env,
  uid: string,
  key: string,
  response: unknown
): Promise<void> {
  await env.DB.prepare(`
    INSERT OR IGNORE INTO idempotency_results
      (uid, idempotency_key, response_json, created_at)
    VALUES (?, ?, ?, ?)
  `).bind(uid, key, JSON.stringify(response), new Date().toISOString()).run();
}

export async function clearConnection(env: Env, uid: string): Promise<void> {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM google_connections WHERE uid = ?").bind(uid),
    env.DB.prepare("DELETE FROM selected_calendars WHERE uid = ?").bind(uid),
    env.DB.prepare("DELETE FROM calendar_sync_state WHERE uid = ?").bind(uid),
    env.DB.prepare("DELETE FROM google_event_links WHERE uid = ?").bind(uid),
    env.DB.prepare("DELETE FROM idempotency_results WHERE uid = ?").bind(uid),
  ]);
}
