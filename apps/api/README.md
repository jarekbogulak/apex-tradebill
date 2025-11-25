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

Key values in `.env` (validated by `src/config/env.ts` at startup):

- `SUPABASE_DB_URL` – PostgreSQL connection string (SSL toggled via `SUPABASE_DB_SSL`).
- `SUPABASE_DB_POOL_MIN`, `SUPABASE_DB_POOL_MAX`, `SUPABASE_DB_IDLE_TIMEOUT_MS` – optional pool tuning knobs.
- `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE` – required for signing/verifying API requests. If `JWT_SECRET` is omitted, the server reuses `APEX_OMNI_API_SECRET` (with a warning); `JWT_ISSUER` and `JWT_AUDIENCE` fall back to `apex-tradebill` / `apex-tradebill-clients` respectively.
- `APEX_TRADEBILL_AUTH_ALLOW_GUEST` – allow unauthenticated read-only clients. Defaults to `true` outside production and `false` in production.
- `APEX_ALLOW_IN_MEMORY_DB` – opt-in toggle for using the in-memory trade repository when Postgres is unavailable (defaults to `true` outside production).
- `APEX_ALLOW_IN_MEMORY_MARKET_DATA` – opt-in toggle for synthetic market data when ApeX Omni credentials are missing (defaults to `true` outside production).
- `APEX_OMNI_*` – credentials, REST, and WebSocket endpoints for ApeX Omni (`*_TESTNET_*` values support sandbox usage).
- `GCP_PROJECT_ID` – production Google Cloud project hosting the `apex-omni-*` secrets. The API refuses to start in production without this value.
- `OMNI_BREAKGLASS_PUBLIC_KEY` – base64-encoded Curve25519 public key used to encrypt break-glass payloads submitted by operators. Required in production.
- `OMNI_BREAKGLASS_PRIVATE_KEY` – base64-encoded Curve25519 private key used by the API to decrypt break-glass payloads. Required in production.
- `OMNI_CACHE_TTL_SECONDS` – cache duration for Google Secret Manager fetches (defaults to 300 seconds).
- `OMNI_ALLOW_LATEST_VERSION` – when `false`, disallows the `latest` alias for GSM secrets and requires a pinned version; defaults to `true`.

### Google Secret Manager (production-only)

- Grant the API service account `roles/secretmanager.secretAccessor` and any operator automation identity `roles/secretmanager.admin`.
- Populate the `apex-omni-*` secrets in GSM before deploying the API.
- If `GCP_PROJECT_ID` or `OMNI_BREAKGLASS_PUBLIC_KEY` is missing in production, `src/config/env.ts` throws a `ConfigError` and the server aborts startup so secrets are never read from unsafe sources.
- When GSM is unreachable at runtime, the Omni routes degrade and emit alerts; after 30 minutes all break-glass payloads expire automatically.

### Security & CI checks

- Run `pnpm --filter @apex-tradebill/api security:scan` locally or inside CI to execute both secrets scanning (`pnpm dlx gitleaks detect`) and `pnpm audit` against this package. This satisfies the constitution’s *Security and Secrets Protection* and *Test-First and Reliability* mandates.
- The `security:secrets` and `security:audit` subtasks live in `apps/api/package.json` and should be wired into whatever CI runner protects `main`. Failing scans must block merges per the constitution.

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

## Device Provisioning & JWT Bootstrap

The mobile client now authenticates each device with a signed JWT. Provisioning happens in two stages:

1. **Issue an activation code** using the CLI (writes a record to `device_activation_codes`).

   ```bash
   pnpm --filter @apex-tradebill/api auth:issue-device-code --device my-test-device
   ```

   The command prints the device identifier, expiration, and activation code. Share that code with the corresponding device (paste, QR, etc.) before it expires.

2. **Register the device** from the app. On launch the Expo client shows the device identifier and prompts for the activation code. Submitting the code calls `POST /v1/auth/device/register`, which:
   - Validates and consumes the activation code
   - Creates (or reuses) an `app_users` record and device binding
   - Issues an HS256 JWT scoped to the user/device

The JWT is stored in secure storage on the device and attached as a Bearer token on subsequent API requests. When registrations are in place, enable Supabase RLS with policies keyed to `user_id` so that history and settings are only returned for authenticated users.

## Additional References

- Shared engineering guidelines: `../../AGENTS.md`
- Database migration docs: `../../configs/db/migrations/README.md`
- Apex Omni API documentation: https://api-docs.pro.apex.exchange/
