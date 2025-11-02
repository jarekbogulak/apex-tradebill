# Apex TradeBill API

TypeScript Fastify 5 service that brokers Apex Omni market data and executes risk calculations for the mobile client. The server runs on Node.js 22, streams live ticks over `ws` 8, and shares DTOs with the rest of the monorepo via `@apex-tradebill/types`.

## Prerequisites

- Node.js 22 (managed with Corepack)
- pnpm 9 (`corepack enable pnpm`)
- PostgreSQL 16 or Supabase instance reachable from your machine

Install dependencies from the repository root before running any scripts:

```bash
corepack pnpm install
```

## Environment Variables

Copy the template and tailor it to your environment:

```bash
cp apps/api/.env.example apps/api/.env
```

Key values in `.env`:

- `SUPABASE_DB_URL` – PostgreSQL connection string (SSL toggled via `SUPABASE_DB_SSL`).
- `SUPABASE_DB_POOL_MIN`, `SUPABASE_DB_POOL_MAX`, `SUPABASE_DB_IDLE_TIMEOUT_MS` – optional pool tuning knobs.
- `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE` – enable signed client auth if required.
- `APEX_TRADEBILL_AUTH_ALLOW_GUEST` – allow unauthenticated read-only clients in development.
- `APEX_OMNI_*` – credentials, REST, and WebSocket endpoints for Apex Omni (`*_TESTNET_*` values support sandbox usage).

## Common Scripts

Run these from the repo root unless otherwise noted:

```bash
pnpm --filter @apex-tradebill/api dev      # Start Fastify with tsx watcher
pnpm --filter @apex-tradebill/api build    # Emit compiled output to dist/
pnpm --filter @apex-tradebill/api start    # Launch the compiled server
pnpm --filter @apex-tradebill/api migrate  # Apply pending SQL migrations
pnpm --filter @apex-tradebill/api db:check # Verify SUPABASE_DB_URL connectivity
pnpm --filter @apex-tradebill/api lint     # Lint the workspace
pnpm --filter @apex-tradebill/api typecheck
pnpm --filter @apex-tradebill/api test     # Jest unit tests (passWithNoTests)
```

Database migrations live in `configs/db/migrations`. The helper script (`src/scripts/runMigrations.ts`) reads your `.env` file automatically and tracks applied versions in `schema_migrations`.

Use `pnpm --filter @apex-tradebill/api db:check` to confirm that the API can reach the database specified in `SUPABASE_DB_URL` (or `DATABASE_URL`). It issues a lightweight `SELECT 1` through the same pool used by the server and reports either success or the underlying connection error.

## Additional References

- Shared engineering guidelines: `../../AGENTS.md`
- Database migration docs: `../../configs/db/migrations/README.md`
- Apex Omni API documentation: https://api-docs.pro.apex.exchange/
