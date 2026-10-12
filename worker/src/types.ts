export interface Env {
  DB: D1Database;
  FIREBASE_PROJECT_ID: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  TOKEN_ENCRYPTION_KEY: string;
  ALLOWED_WEB_ORIGINS?: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export interface GoogleConnectionRow {
  uid: string;
  google_account_id: string;
  refresh_token_ciphertext: string;
  refresh_token_iv: string;
  granted_scopes: string;
}

export interface GoogleEventLinkRow {
  uid: string;
  app_schedule_id: string;
  calendar_id: string;
  google_event_id: string;
  etag: string | null;
}
