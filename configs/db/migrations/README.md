# Database Migrations – Apex TradeBill

This directory stores ANSI SQL migration files for the Supabase-managed (vanilla PostgreSQL 16) database that powers user profiles, settings, and trade calculation history. Migrations are applied sequentially in timestamp order by `node-pg-migrate` via `apps/api/src/adapters/persistence/providers/postgres/migrations.ts`.

## Folder Layout

```
configs/db/migrations
├── README.md          # this file
└── *.sql              # timestamped migration files
```

## Naming Convention

Create new migrations with a sortable timestamp prefix followed by a short slug. Example:

```
20250215T120000__create_trade_calculations.sql
```

Keep filenames ASCII and use double underscores (`__`) between the timestamp and the description so ordering remains deterministic across platforms.

## Authoring Migrations

- Stick to standard SQL (no Supabase-specific extensions) so the schema remains portable.
- Wrap multiple statements in a single file; the migration runner executes each file within a transaction.
- Prefer `IF NOT EXISTS` / `IF EXISTS` clauses when (re)creating indexes or tables to support idempotent rollout across environments.

Example skeleton:

```sql
-- 20250215T120000__create_trade_calculations.sql
CREATE TABLE IF NOT EXISTS trade_calculations (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  input JSONB NOT NULL,
  output JSONB NOT NULL,
  market_snapshot JSONB NOT NULL,
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trade_calculations_user_created_idx
  ON trade_calculations (user_id, created_at DESC);
```

## Applying Migrations

1. Ensure the environment variable `SUPABASE_DB_URL` (or `DATABASE_URL`) is exported with a valid connection string. Additional optional variables:
   - `SUPABASE_DB_POOL_MIN`, `SUPABASE_DB_POOL_MAX`
   - `SUPABASE_DB_IDLE_TIMEOUT_MS`
   - `SUPABASE_DB_SSL` (`require` to force SSL, `disable` to disable)
2. From the repository root run:

```bash
pnpm --filter @apex-tradebill/api migrate
```

The script will apply any pending migrations under an advisory lock (via `node-pg-migrate`) and record their identifiers in the `pgmigrations` table. Legacy identifiers stored in `schema_migrations` are copied forward automatically to avoid double-runs during the transition.

## Rolling Back

Migrations are append-only. To revert, author a new migration that undoes the previous change (e.g., drop tables, remove columns) and apply it using the same command.

## Troubleshooting

- If the script reports `pg module not available`, install dependencies in the api workspace: `pnpm --filter @apex-tradebill/api install`.
- When running against Supabase-hosted instances, TLS is enabled automatically; set `SUPABASE_DB_SSL=disable` only for trusted local development containers.
