ALTER TABLE calendar_sync_state ADD COLUMN window_start_ms INTEGER;
ALTER TABLE calendar_sync_state ADD COLUMN window_end_ms INTEGER;
ALTER TABLE calendar_sync_state ADD COLUMN pending_sync_token TEXT;
ALTER TABLE calendar_sync_state ADD COLUMN pending_window_start_ms INTEGER;
ALTER TABLE calendar_sync_state ADD COLUMN pending_window_end_ms INTEGER;
