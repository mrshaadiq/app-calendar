import {createHash} from "node:crypto";
import {google, type calendar_v3} from "googleapis";
import {DateTime} from "luxon";

export interface MappedGoogleEvent {
  googleEventId: string;
  googleCalendarId: string;
  title: string;
  startMs: number;
  endMs: number;
  allDay: boolean;
  timeZone: string;
  recurrence: string[] | null;
  createdAtMs: number | null;
}

export function createGoogleScheduleId(
  calendarId: string,
  eventId: string
): string {
  const hash = createHash("sha256")
    .update(`${calendarId}:${eventId}`)
    .digest("hex");
  return `google_${hash}`;
}

export function mapGoogleEvent(
  event: calendar_v3.Schema$Event,
  calendarId: string,
  defaultTimeZone: string
): MappedGoogleEvent | null {
  if (!event.id || !event.start || !event.end) {
    return null;
  }

  const timeZone = event.start.timeZone || defaultTimeZone;
  const allDay = Boolean(event.start.date);
  const start = allDay ?
    DateTime.fromISO(event.start.date!, {zone: timeZone}).startOf("day") :
    DateTime.fromISO(event.start.dateTime || "", {
      zone: timeZone,
      setZone: true,
    });
  const end = allDay ?
    DateTime.fromISO(event.end.date || "", {zone: timeZone}).startOf("day") :
    DateTime.fromISO(event.end.dateTime || "", {
      zone: timeZone,
      setZone: true,
    });

  if (!start.isValid || !end.isValid || end <= start) {
    return null;
  }

  const createdAtMs = event.created ? Date.parse(event.created) : NaN;
  return {
    googleEventId: event.id,
    googleCalendarId: calendarId,
    title: event.summary || "Jadwal tanpa judul",
    startMs: start.toMillis(),
    endMs: end.toMillis(),
    allDay,
    timeZone,
    recurrence: event.recurrence ?? null,
    createdAtMs: Number.isFinite(createdAtMs) ? createdAtMs : null,
  };
}

export function createGoogleClient(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): calendar_v3.Calendar {
  const oauth = new google.auth.OAuth2(clientId, clientSecret, "");
  oauth.setCredentials({refresh_token: refreshToken});
  return google.calendar({version: "v3", auth: oauth});
}

export function createOAuthClient(clientId: string, clientSecret: string) {
  return new google.auth.OAuth2(clientId, clientSecret, "");
}
