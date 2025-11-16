CREATE TABLE IF NOT EXISTS omni_secret_access_events (
  id BIGSERIAL PRIMARY KEY,
  secret_type TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  result TEXT NOT NULL,
  error_code TEXT,
  gcp_secret_version TEXT,
  duration_ms INTEGER,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS omni_secret_access_events_secret_type_idx
  ON omni_secret_access_events (secret_type);

CREATE INDEX IF NOT EXISTS omni_secret_access_events_recorded_at_idx
  ON omni_secret_access_events (recorded_at DESC);
