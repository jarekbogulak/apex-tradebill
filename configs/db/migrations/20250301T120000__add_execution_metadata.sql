ALTER TABLE trade_calculations
  ADD COLUMN IF NOT EXISTS execution_method TEXT DEFAULT 'execute-button' NOT NULL,
  ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;

UPDATE trade_calculations
SET execution_method = COALESCE(execution_method, 'execute-button'),
    executed_at = COALESCE(executed_at, created_at)
WHERE execution_method IS NULL
   OR executed_at IS NULL;

ALTER TABLE trade_calculations
  ALTER COLUMN execution_method DROP DEFAULT,
  ALTER COLUMN executed_at DROP DEFAULT;
