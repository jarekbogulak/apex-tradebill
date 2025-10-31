# Apex TradeBill: End-to-End Setup & Troubleshooting

## Overview
Apex TradeBill is delivered as a pnpm-managed Expo + Fastify monorepo. This guide walks through environment setup, local development workflows, validation gates, and common recovery steps so you can move from a clean checkout to a profiled build quickly.

## Prerequisites
- Node.js 22 LTS (matching the repo `engines.node` constraint)
- pnpm 9.12 or newer (`corepack enable` is recommended)
- Xcode 16 / Android SDK 35 for device simulators
- Expo CLI (`pnpm dlx expo@latest install` will bootstrap on demand)
- PostgreSQL 16 (locally or via Docker) for API persistence
- jq + curl for contract smoke checks (optional but useful)

## Initial Setup
1. Install workspace dependencies:
   ```sh
   pnpm install
   ```
2. Seed local environment variables:
   - Copy `apps/api/.env.example` → `.env` and adjust database connection details.
   - Copy `apps/mobile/.env.example` → `.env` and set `EXPO_PUBLIC_API_BASE_URL`.
3. Prepare the database:
   ```sh
   pnpm --filter @apex-tradebill/api migrate
   ```
4. (Optional) Start PostgreSQL via Docker:
   ```sh
   docker compose up db
   ```

## Running the Stack
- **API**: `pnpm --filter @apex-tradebill/api dev` (Fastify with live reload via `tsx`)
- **Expo app**: `pnpm --filter @apex-tradebill/mobile start`
  - Use the QR code, iOS simulator (`i`), or Android emulator (`a`) from the Expo CLI prompt.
- **Shared packages** auto-reload thanks to Metro and the configured TypeScript project references.

## Testing & Quality Gates
- **Unit & integration**: `pnpm test` (runs all workspace suites)
- **API unit target**: `pnpm --filter @apex-tradebill/api test`
- **Mobile unit target**: `pnpm --filter @apex-tradebill/mobile test`
- **Contract tests**: `pnpm --filter @apex-tradebill/tests test -- contract`
- **Performance**:
  - Latency budgets: `pnpm --filter @apex-tradebill/tests test -- performance`
  - FPS profiling summary: `pnpm exec ts-node tests/performance/mobile-fps.profile.ts`
- **Security**:
  - Dependency + OpenAPI scanning: `pnpm security:scan`

## Profiling Workflows
- Capture latency samples (JSON array per channel) and point the test harness at them:
  ```sh
  APEX_LATENCY_SAMPLE_PATH=artifacts/latency.json pnpm --filter @apex-tradebill/tests test -- performance
  ```
- Record Expo FPS traces (e.g., via Dev Menu “Toggle Performance Monitor”) and export frame durations:
  ```sh
  APEX_FPS_TRACE_PATH=artifacts/fps-trace.json pnpm exec ts-node tests/performance/mobile-fps.profile.ts
  ```
- Add artifacts under `tests/performance/fixtures/` for reproducible baselines.

## Troubleshooting
- **`pnpm` not found**: ensure `corepack enable` and restart the shell; macOS users may need to relink `~/.local/share/pnpm`.
- **Metro cannot resolve packages**: run `pnpm install`, clear cache (`pnpm --filter @apex-tradebill/mobile expo start -c`), and confirm the workspace symlinks under `node_modules`.
- **Expo bundler hangs on secure store**: make sure the device/emulator has a screen lock configured; otherwise SecureStore initialization will block.
- **API refuses connections**: verify `.env` database credentials and that migrations ran; `pnpm --filter @apex-tradebill/api dev -- --inspect` will expose detailed Fastify logs.
- **Contract tests fail due to spec drift**: regenerate SDK types (`pnpm --filter @apex-tradebill/types build`) and re-run Spectral via `pnpm security:openapi`.
- **Performance checks skip**: both harnesses look for JSON fixtures; capture fresh data and set `APEX_LATENCY_SAMPLE_PATH` / `APEX_FPS_TRACE_PATH`.

## Operational Notes
- The realtime refresh cadence is fixed at 1s; verify both the API and mobile schedulers (`apps/api/src/realtime/refreshScheduler.ts`, `apps/mobile/src/features/stream/refreshScheduler.ts`) when tuning.
- Keep the ApeX symbol allowlist (`configs/markets/allowlist.json`) synchronized with production; contract tests depend on the documented schema.
- When publishing builds, run `pnpm security:scan` and ensure Spectral passes—CI expects clean output before promoting artifacts.
