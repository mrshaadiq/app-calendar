import {DateTime} from "luxon";
import {googleAccountIdFromTokens, requireFirebaseIdentity} from "./auth";
import {sha256Hex} from "./crypto";
import {
  exchangeServerAuthCode,
  getGoogleAccessToken,
  googleRequest,
  listCalendars,
  listEventsForSync,
  type GoogleEvent,
} from "./google";
import {
  clearConnection,
  deleteEventLink,
  getConnection,
  getEventLink,
  getIdempotentResult,
  getRefreshToken,
  getCalendarSyncState,
  getSelectedCalendars,
  acknowledgeCalendarSyncToken,
  saveConnection,
  saveEventLink,
  saveIdempotentResult,
  saveSelectedCalendars,
  stageCalendarSyncToken,
} from "./store";
import {ApiError, type Env} from "./types";

function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {"Content-Type": "application/json", ...(headers || {})},
  });
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > 32_000) throw new ApiError(413, "Permintaan terlalu besar.");
  const raw = await request.text();
  if (raw.length > 32_000) throw new ApiError(413, "Permintaan terlalu besar.");
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Body invalid");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new ApiError(400, "Isi permintaan harus JSON yang valid.");
  }
}

function stringField(body: Record<string, unknown>, key: string, max: number): string {
  const value = body[key];
  if (typeof value !== "string" || value.length === 0 || value.length > max) {
    throw new ApiError(400, `${key} tidak valid.`);
  }
  return value;
}

function originHeaders(request: Request, env: Env): Headers {
  const headers = new Headers();
  const origin = request.headers.get("Origin");
  if (!origin) return headers;
  const allowed = (env.ALLOWED_WEB_ORIGINS || "").split(",")
    .map((item) => item.trim()).filter(Boolean);
  if (!allowed.includes(origin)) {
    throw new ApiError(403, "Origin web tidak diizinkan.");
  }
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Vary", "Origin");
  headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  return headers;
}

async function route(request: Request, env: Env): Promise<Response> {
  const pathname = new URL(request.url).pathname;
  if (pathname === "/health" && request.method === "GET") {
    return json({ok: true});
  }
  const identity = await requireFirebaseIdentity(request, env);
  const uid = identity.sub;

  if (pathname === "/v1/google/connect" && request.method === "POST") {
    const body = await readJson(request);
    const code = stringField(body, "serverAuthCode", 10_000);
    const tokens = await exchangeServerAuthCode(env, code);
    const googleAccountId = await googleAccountIdFromTokens(
      tokens.id_token,
      tokens.access_token!,
      env.GOOGLE_CLIENT_ID
    );
    const firebaseGoogleIds = identity.firebase?.identities?.["google.com"] || [];
    if (!firebaseGoogleIds.includes(googleAccountId)) {
      throw new ApiError(403, "Akun Google Calendar berbeda dari akun login.");
    }
    const previous = await env.DB.prepare(
      "SELECT google_account_id FROM google_connections WHERE uid = ?"
    ).bind(uid).first<{google_account_id: string}>();
    const refreshToken = tokens.refresh_token ||
      (previous?.google_account_id === googleAccountId ?
        await getRefreshToken(env, uid) : null);
    if (!refreshToken) {
      throw new ApiError(409, "Izin offline Google belum diberikan. Hubungkan ulang akun.");
    }
    await saveConnection(env, uid, googleAccountId, refreshToken, tokens.scope || "");
    const calendars = await listCalendars(tokens.access_token!);
    const primary = calendars.find((item) => item.primary);
    if (primary && (await getSelectedCalendars(env, uid)).length === 0) {
      await saveSelectedCalendars(env, uid, [primary.id]);
    }
    return json({connected: true, calendars});
  }

  if (pathname === "/v1/google/calendars" && request.method === "GET") {
    const accessToken = await getGoogleAccessToken(env, uid);
    const calendars = await listCalendars(accessToken);
    const selectedCalendarIds = await getSelectedCalendars(env, uid);
    return json({calendars, selectedCalendarIds});
  }

  if (pathname === "/v1/google/calendars/selection" && request.method === "PUT") {
    const body = await readJson(request);
    const calendarIds = body.calendarIds;
    if (!Array.isArray(calendarIds) || calendarIds.length < 1 ||
        calendarIds.length > 10 ||
        calendarIds.some((item) => typeof item !== "string" || item.length > 256) ||
        new Set(calendarIds).size !== calendarIds.length) {
      throw new ApiError(400, "Pilih 1 sampai 10 kalender yang berbeda.");
    }
    const accessToken = await getGoogleAccessToken(env, uid);
    const available = new Set((await listCalendars(accessToken)).map((item) => item.id));
    if (calendarIds.some((id) => !available.has(id))) {
      throw new ApiError(400, "Ada kalender yang tidak dapat diakses.");
    }
    await saveSelectedCalendars(env, uid, calendarIds as string[]);
    return json({selectedCalendarIds: calendarIds});
  }

  if (pathname === "/v1/google/sync" && request.method === "POST") {
    const selected = await getSelectedCalendars(env, uid);
    if (selected.length === 0) throw new ApiError(409, "Pilih kalender Google dahulu.");
    const body = await readJson(request);
    const timeZone = typeof body.timeZone === "string" && body.timeZone.length < 100 ?
      body.timeZone : "Asia/Jakarta";
    const now = DateTime.now().setZone(timeZone);
    if (!now.isValid) throw new ApiError(400, "Zona waktu tidak valid.");
    const windowStart = now.minus({days: 30}).startOf("day");
    const windowEnd = now.plus({days: 90}).endOf("day");
    const accessToken = await getGoogleAccessToken(env, uid);
    const calendars = await listCalendars(accessToken);
    const available = new Map(calendars.map((item) => [item.id, item]));
    const results = [];
    for (const calendarId of selected) {
      const calendar = available.get(calendarId);
      if (!calendar) throw new ApiError(409, "Kalender terpilih tidak dapat diakses. Perbarui pilihan kalender.");
      const state = await getCalendarSyncState(env, uid, calendarId);
      const previousToken = state?.window_start_ms === windowStart.toMillis() &&
        state?.window_end_ms === windowEnd.toMillis() ? state.sync_token : null;
      let result;
      try {
        result = await listEventsForSync(accessToken, calendarId,
          windowStart.toUTC().toISO()!, windowEnd.toUTC().toISO()!,
          calendar.timeZone || timeZone, previousToken);
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 410 || !previousToken) throw error;
        result = await listEventsForSync(accessToken, calendarId,
          windowStart.toUTC().toISO()!, windowEnd.toUTC().toISO()!,
          calendar.timeZone || timeZone, null);
      }
      await stageCalendarSyncToken(env, uid, calendarId, result.nextSyncToken,
        windowStart.toMillis(), windowEnd.toMillis());
      results.push({calendarId, ...result});
    }
    return json({
      calendars: results,
      windowStartMs: windowStart.toMillis(),
      windowEndMs: windowEnd.toMillis(),
    });
  }

  if (pathname === "/v1/google/sync/ack" && request.method === "POST") {
    const body = await readJson(request);
    const calendarId = stringField(body, "calendarId", 256);
    const nextSyncToken = stringField(body, "nextSyncToken", 4096);
    if (!(await getSelectedCalendars(env, uid)).includes(calendarId)) {
      throw new ApiError(403, "Kalender tidak dipilih.");
    }
    await acknowledgeCalendarSyncToken(env, uid, calendarId, nextSyncToken);
    return json({acknowledged: true});
  }

  if (pathname === "/v1/google/events/upsert" && request.method === "POST") {
    const body = await readJson(request);
    const appScheduleId = stringField(body, "appScheduleId", 128);
    const calendarId = stringField(body, "calendarId", 256);
    const idempotencyKey = stringField(body, "idempotencyKey", 128);
    const title = stringField(body, "title", 500).trim();
    const startMs = body.startMs;
    const endMs = body.endMs;
    const timeZone = stringField(body, "timeZone", 100);
    if (typeof startMs !== "number" || typeof endMs !== "number" ||
        !Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs ||
        !DateTime.now().setZone(timeZone).isValid || !title) {
      throw new ApiError(400, "Tanggal atau judul acara tidak valid.");
    }
    const recurrence = body.recurrence;
    if (recurrence !== null && recurrence !== undefined &&
        (!Array.isArray(recurrence) || recurrence.length > 5 ||
         recurrence.some((item) => typeof item !== "string" ||
           !item.startsWith("RRULE:") || item.length > 300))) {
      throw new ApiError(400, "Aturan pengulangan tidak valid.");
    }
    const priorResult = await getIdempotentResult(env, uid, idempotencyKey);
    if (priorResult) return json(priorResult);
    const selected = await getSelectedCalendars(env, uid);
    if (!selected.includes(calendarId)) {
      throw new ApiError(403, "Kalender tujuan belum dipilih.");
    }
    const connection = await getConnection(env, uid);
    const grantedScopes = new Set(connection.granted_scopes.split(/\s+/));
    if (!grantedScopes.has("https://www.googleapis.com/auth/calendar.events") &&
        !grantedScopes.has("https://www.googleapis.com/auth/calendar")) {
      throw new ApiError(403, "Izin mengedit Google Calendar belum diberikan.");
    }
    const accessToken = await getGoogleAccessToken(env, uid);
    const calendars = await listCalendars(accessToken);
    const target = calendars.find((item) => item.id === calendarId);
    if (!target || !["writer", "owner"].includes(target.accessRole || "")) {
      throw new ApiError(403, "Kalender tidak dapat ditulis.");
    }
    const eventBody: GoogleEvent = {
      summary: title,
      start: {dateTime: DateTime.fromMillis(startMs, {zone: timeZone}).toISO()!, timeZone},
      end: {dateTime: DateTime.fromMillis(endMs, {zone: timeZone}).toISO()!, timeZone},
      recurrence: recurrence as string[] | undefined,
      extendedProperties: {private: {appScheduleId}},
    };
    const link = await getEventLink(env, uid, appScheduleId);
    if (link && link.calendar_id !== calendarId) {
      throw new ApiError(409, "Pindah kalender memerlukan tindakan terpisah.");
    }
    let saved: GoogleEvent;
    if (link) {
      saved = await googleRequest<GoogleEvent>(accessToken,
        `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(link.google_event_id)}`,
        {method: "PATCH", headers: link.etag ? {"If-Match": link.etag} : {},
          body: JSON.stringify(eventBody)});
    } else {
      const deterministicId = `a${await sha256Hex(`${uid}:${appScheduleId}:${calendarId}`)}`;
      try {
        saved = await googleRequest<GoogleEvent>(accessToken,
          `/calendars/${encodeURIComponent(calendarId)}/events`,
          {method: "POST", body: JSON.stringify({...eventBody, id: deterministicId})});
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 409) throw error;
        const existing = await googleRequest<GoogleEvent>(accessToken,
          `/calendars/${encodeURIComponent(calendarId)}/events/${deterministicId}`);
        if (existing.extendedProperties?.private?.appScheduleId !== appScheduleId) {
          throw new ApiError(409, "ID acara Google dipakai oleh acara lain.");
        }
        saved = existing;
      }
    }
    if (!saved.id) throw new ApiError(502, "Google tidak mengembalikan ID acara.");
    await saveEventLink(env, uid, appScheduleId, calendarId, saved.id, saved.etag || null);
    const result = {googleEventId: saved.id, googleCalendarId: calendarId,
      etag: saved.etag || null};
    await saveIdempotentResult(env, uid, idempotencyKey, result);
    return json(result);
  }

  if (pathname === "/v1/google/events/cancel" && request.method === "POST") {
    const body = await readJson(request);
    const appScheduleId = stringField(body, "appScheduleId", 128);
    const link = await getEventLink(env, uid, appScheduleId);
    if (!link) return json({cancelled: true});
    const accessToken = await getGoogleAccessToken(env, uid);
    try {
      await googleRequest(accessToken,
        `/calendars/${encodeURIComponent(link.calendar_id)}/events/${encodeURIComponent(link.google_event_id)}`,
        {method: "DELETE", headers: link.etag ? {"If-Match": link.etag} : {}});
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) throw error;
    }
    await deleteEventLink(env, uid, appScheduleId);
    return json({cancelled: true});
  }

  if (pathname === "/v1/google/disconnect" && request.method === "POST") {
    const refreshToken = await getRefreshToken(env, uid);
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: {"Content-Type": "application/x-www-form-urlencoded"},
      body: new URLSearchParams({token: refreshToken}),
    }).catch(() => undefined);
    await clearConnection(env, uid);
    return json({disconnected: true});
  }

  throw new ApiError(404, "Endpoint tidak ditemukan.");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    let cors = new Headers();
    try {
      cors = originHeaders(request, env);
      if (request.method === "OPTIONS") {
        return new Response(null, {status: 204, headers: cors});
      }
      const response = await route(request, env);
      cors.forEach((value, key) => response.headers.set(key, value));
      response.headers.set("Cache-Control", "no-store");
      return response;
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 500;
      if (status >= 500) console.error("Worker request failed", error);
      const response = json({error: error instanceof ApiError ?
        error.message : "Layanan kalender sedang bermasalah."}, status);
      cors.forEach((value, key) => response.headers.set(key, value));
      response.headers.set("Cache-Control", "no-store");
      return response;
    }
  },
};
