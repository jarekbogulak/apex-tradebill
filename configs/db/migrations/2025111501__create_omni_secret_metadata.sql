CREATE TABLE IF NOT EXISTS omni_secret_metadata (
  secret_type TEXT PRIMARY KEY,
  environment TEXT NOT NULL DEFAULT 'production',
  gcp_secret_id TEXT NOT NULL,
  gcp_version_alias TEXT NOT NULL DEFAULT 'latest',
  status TEXT NOT NULL DEFAULT 'active',
  rotation_due_at TIMESTAMPTZ NOT NULL,
  last_rotated_at TIMESTAMPTZ,
  last_validated_at TIMESTAMPTZ,
  owner TEXT,
  break_glass_enabled_until TIMESTAMPTZ,
  cache_source TEXT NOT NULL DEFAULT 'gsm',
  cache_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS omni_secret_metadata_environment_secret_type_idx
  ON omni_secret_metadata (environment, secret_type);
