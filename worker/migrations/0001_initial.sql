CREATE TABLE IF NOT EXISTS google_connections (
  uid TEXT PRIMARY KEY,
  google_account_id TEXT NOT NULL,
  refresh_token_ciphertext TEXT NOT NULL,
  refresh_token_iv TEXT NOT NULL,
  granted_scopes TEXT NOT NULL,
  connected_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS selected_calendars (
  uid TEXT NOT NULL,
  calendar_id TEXT NOT NULL,
  PRIMARY KEY (uid, calendar_id)
);

CREATE TABLE IF NOT EXISTS calendar_sync_state (
  uid TEXT NOT NULL,
  calendar_id TEXT NOT NULL,
  sync_token TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (uid, calendar_id)
);

CREATE TABLE IF NOT EXISTS google_event_links (
  uid TEXT NOT NULL,
  app_schedule_id TEXT NOT NULL,
  calendar_id TEXT NOT NULL,
  google_event_id TEXT NOT NULL,
  etag TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (uid, app_schedule_id)
);

CREATE TABLE IF NOT EXISTS idempotency_results (
  uid TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (uid, idempotency_key)
);
