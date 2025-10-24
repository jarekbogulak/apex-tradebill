CREATE TABLE IF NOT EXISTS trade_calculations (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  input JSONB NOT NULL,
  output JSONB NOT NULL,
  market_snapshot JSONB NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('live', 'manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trade_calculations_user_created_idx
  ON trade_calculations (user_id, created_at DESC);
