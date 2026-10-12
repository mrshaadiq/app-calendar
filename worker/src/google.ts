import {DateTime} from "luxon";
import {sha256Hex} from "./crypto";
import {getRefreshToken} from "./store";
import {ApiError, type Env} from "./types";

const calendarApi = "https://www.googleapis.com/calendar/v3";

interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
  error?: string;
}

export interface GoogleEvent {
  id?: string;
  etag?: string;
  status?: string;
  summary?: string;
  start?: {date?: string; dateTime?: string; timeZone?: string};
  end?: {date?: string; dateTime?: string; timeZone?: string};
  recurrence?: string[];
  recurringEventId?: string;
  originalStartTime?: {date?: string; dateTime?: string; timeZone?: string};
  extendedProperties?: {private?: Record<string, string>};
}

export interface CalendarEntry {
  id: string;
  summary: string;
  primary?: boolean;
  accessRole?: string;
  timeZone?: string;
}

export interface MappedEvent {
  id: string;
  googleEventId: string;
  googleCalendarId: string;
  title: string;
  startMs: number;
  endMs: number;
  allDay: boolean;
  timeZone: string;
  recurrence: string[] | null;
  recurringEventId: string | null;
  originalStartTime: string | null;
  etag: string | null;
  appScheduleId: string | null;
}

async function oauthRequest(env: Env, fields: Record<string, string>): Promise<GoogleTokenResponse> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {"Content-Type": "application/x-www-form-urlencoded"},
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      ...fields,
    }),
  });
  const data = await response.json() as GoogleTokenResponse;
  if (!response.ok || !data.access_token) {
    throw new ApiError(409, "Izin Google kedaluwarsa atau ditolak. Hubungkan ulang kalender.");
  }
  return data;
}

export async function exchangeServerAuthCode(env: Env, code: string) {
  return oauthRequest(env, {
    code,
    grant_type: "authorization_code",
    redirect_uri: "",
  });
}

export async function getGoogleAccessToken(env: Env, uid: string): Promise<string> {
  const refreshToken = await getRefreshToken(env, uid);
  const tokens = await oauthRequest(env, {
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  return tokens.access_token!;
}

export async function googleRequest<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${calendarApi}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? {"Content-Type": "application/json"} : {}),
      ...(init.headers || {}),
    },
  });
  if (response.status === 412) throw new ApiError(409, "Acara berubah di Google. Tinjau ulang sebelum menyimpan.");
  if (response.status === 410) throw new ApiError(410, "Token sinkronisasi Google kedaluwarsa.");
  if (response.status === 409) throw new ApiError(409, "Acara Google sudah ada.");
  if (response.status === 404) throw new ApiError(404, "Acara Google tidak ditemukan.");
  if (!response.ok) {
    throw new ApiError(response.status >= 500 ? 502 : 400,
      "Google Calendar menolak permintaan. Periksa izin kalender.");
  }
  if (response.status === 204) return {} as T;
  return response.json() as Promise<T>;
}

export async function listCalendars(accessToken: string): Promise<CalendarEntry[]> {
  const entries: CalendarEntry[] = [];
  let pageToken: string | undefined;
  do {
    const query = new URLSearchParams({maxResults: "250"});
    if (pageToken) query.set("pageToken", pageToken);
    const response = await googleRequest<{
      items?: CalendarEntry[];
      nextPageToken?: string;
    }>(accessToken, `/users/me/calendarList?${query}`);
    entries.push(...(response.items || []).filter((item) => item.id));
    pageToken = response.nextPageToken;
  } while (pageToken && entries.length < 1000);
  return entries;
}

export async function mapGoogleEvent(
  event: GoogleEvent,
  calendarId: string,
  defaultTimeZone: string
): Promise<MappedEvent | null> {
  if (!event.id || !event.start || !event.end || event.status === "cancelled") {
    return null;
  }
  const timeZone = event.start.timeZone || defaultTimeZone;
  const allDay = Boolean(event.start.date);
  const start = allDay ?
    DateTime.fromISO(event.start.date || "", {zone: timeZone}).startOf("day") :
    DateTime.fromISO(event.start.dateTime || "", {setZone: true});
  const end = allDay ?
    DateTime.fromISO(event.end.date || "", {zone: timeZone}).startOf("day") :
    DateTime.fromISO(event.end.dateTime || "", {setZone: true});
  if (!start.isValid || !end.isValid || end <= start) return null;
  return {
    id: `google_${await sha256Hex(`${calendarId}:${event.id}`)}`,
    googleEventId: event.id,
    googleCalendarId: calendarId,
    title: event.summary || "Jadwal tanpa judul",
    startMs: start.toMillis(),
    endMs: end.toMillis(),
    allDay,
    timeZone,
    recurrence: event.recurrence || null,
    recurringEventId: event.recurringEventId || null,
    originalStartTime: event.originalStartTime?.dateTime ||
      event.originalStartTime?.date || null,
    etag: event.etag || null,
    appScheduleId: event.extendedProperties?.private?.appScheduleId || null,
  };
}

export interface EventSyncPage {
  mode: "full" | "incremental";
  events: MappedEvent[];
  cancelledIds: string[];
  nextSyncToken: string;
}

export async function listEventsForSync(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string,
  defaultTimeZone: string,
  syncToken: string | null
): Promise<EventSyncPage> {
  const events: MappedEvent[] = [];
  const cancelledIds: string[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;
  do {
    const query = new URLSearchParams({
      singleEvents: "true",
      showDeleted: "true",
      maxResults: "2500",
    });
    if (syncToken) query.set("syncToken", syncToken);
    else {
      query.set("timeMin", timeMin);
      query.set("timeMax", timeMax);
    }
    if (pageToken) query.set("pageToken", pageToken);
    const page = await googleRequest<{
      items?: GoogleEvent[];
      timeZone?: string;
      nextPageToken?: string;
      nextSyncToken?: string;
    }>(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events?${query}`);
    for (const item of page.items || []) {
      if (!item.id) continue;
      if (item.status === "cancelled") {
        cancelledIds.push(`google_${await sha256Hex(`${calendarId}:${item.id}`)}`);
      } else {
        const mapped = await mapGoogleEvent(item, calendarId,
          page.timeZone || defaultTimeZone);
        if (mapped) events.push(mapped);
      }
      if (events.length + cancelledIds.length > 5000) {
        throw new ApiError(413, "Terlalu banyak perubahan kalender untuk satu sinkronisasi.");
      }
    }
    pageToken = page.nextPageToken;
    nextSyncToken = page.nextSyncToken;
  } while (pageToken);
  if (!nextSyncToken) {
    throw new ApiError(502, "Google tidak mengembalikan token sinkronisasi.");
  }
  return {
    mode: syncToken ? "incremental" : "full",
    events,
    cancelledIds,
    nextSyncToken,
  };
}
