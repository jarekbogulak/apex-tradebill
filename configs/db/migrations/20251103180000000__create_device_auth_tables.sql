CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS device_registrations (
  device_id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS device_activation_codes (
  id UUID PRIMARY KEY,
  device_id TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  signature TEXT NOT NULL,
  consumed_at TIMESTAMPTZ,
  consumed_by_device TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS device_activation_codes_device_idx
  ON device_activation_codes (device_id);

CREATE INDEX IF NOT EXISTS device_activation_codes_consumed_idx
  ON device_activation_codes (consumed_at);
