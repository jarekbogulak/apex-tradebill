# Phase 1 Quickstart – Apex TradeBill

## Prerequisites
- Node.js 22.x and pnpm 9 installed on the workstation
- Expo CLI tooling available (`npx expo start --version` > 6)
- Xcode (iOS 16+ simulator) or Android Studio (Android 13+ emulator) for Expo testing
- Optional for later phases: Supabase project (hosted or self-hosted PostgreSQL 16) once persistence tasks land
- ApeX Omni API credentials stored server-side (`apps/api/.env`)

## Bootstrap (Stage 1 – Skeleton)
1. `npx create-expo-app@latest mobile` (runs inside repo root; generates `mobile/`).
2. `pnpm init -y` inside `api/` followed by `pnpm add fastify ws typescript tsx` to scaffold the Node service stub.
3. From repo root, create a workspace `pnpm-workspace.yaml` (Task 001) so both `mobile` and `api` share dependencies; then run `pnpm install`.
4. Copy `.env.example` → `.env` in `api/` once the environment template is authored (tasks TBD). Provide Supabase URL and ApeX Omni credentials so device registration and live data work.

### Device Activation Flow (after migrations)
1. Apply migrations: `pnpm --filter @apex-tradebill/api migrate`.
2. Issue a device activation code for the ID shown in the app:
   ```bash
   pnpm --filter @apex-tradebill/api auth:issue-device-code -- --device <device-id>
   ```
3. Launch the Expo client; enter the activation code on first run. The API returns a JWT that the device stores in SecureStore and sends on every request (`Authorization: Bearer …`, `x-user-id`).
4. Re-issue a code whenever the device ID changes (e.g., simulator reset) or the token expires.

## Bootstrap (Stage 2 – Live Data Wiring)
1. Implement the Fastify server entry point with stubbed responses that satisfy contract placeholders.
2. Add the in-process ring buffer module and hook it to the ApeX Omni WebSocket once credentials are available.
3. Provide Expo-side API client utilities for previewing stub data, then swap to live endpoints when the backend contract solidifies.

## Test-First Loop (Phased)
1. Run `pnpm test --filter api` to execute server unit tests (initial suite mocks the ApeX client).
2. Run `pnpm test --filter mobile` to execute Expo component smoke tests that render the calculator shell.
3. Contract suites in `tests/contract` must ship as executable failing tests. If any scenario is temporarily deferred, mark it with `test.skip` including an accountable owner and target date, and track the follow-up in project docs (no bare `it.todo`). Module-level tests stay colocated next to their source.
4. Property-based suites introduced in T065–T066 should run via `pnpm test --filter api -- --runInBand --property` (or equivalent script) and must pass before shipping calculator changes.
5. Before promoting to staging, run `pnpm lint && pnpm typecheck` plus the latency smoke script (`api/scripts/latency-smoke.ts`) and the Expo FPS profiler (`tests/performance/mobile-fps.profile.ts`) once they land in Phase 2.

## Acceptance Walkthrough (Maps to User Stories)
1. **Live sizing (stub)**: Launch Expo app pointing to the Fastify stub; confirm the calculator screen renders current mock values and updates when mock timers fire.
2. **Live sizing (real feed)**: After the ApeX WebSocket integration task, verify BTC-USDT updates every second and the stale badge appears after two seconds of silence.
3. **Volatility multiplier**: Toggle between multiplier presets (1.0, 1.5, 2.0); confirm suggested stop and position sizing adjust using the shared calculator module.
4. **Execute capture**: Populate valid inputs, press Execute, and verify exactly one history entry is created with the current outputs while the button briefly enters its saving state. Repeat after adjusting inputs to ensure a second entry appends without duplicating the first.
5. **Validation**: Enter invalid stop/target (e.g., stop above entry on long) and ensure Execute remains disabled (or fails gracefully) with explicit error labels; once corrected, Execute should succeed.
6. **Stale fallback**: Simulate feed outage (pause the ApeX client); check UI shows “Stale,” reconnect backoff indicators, and manual price entry unlocks.
7. **Equity sync**: Switch between connected equity and manual entry; confirm labeling and audit trail entries align with the constitution.
8. **History retention**: Once Supabase database writes are enabled, execute multiple trades across more than 30 days of seeded data and ensure only the most recent 30 days of executed calculations appear while older entries prune in nightly jobs.
9. **Risk visualization**: Interact with the calculator while watching the visualization panel; verify entry/stop/target markers stay in sync with numerical outputs, use accessible contrast (WCAG AA), and do not reorder.
10. **Settings panel**: Open the settings screen, update risk %, ATR multiplier, and freshness threshold, then confirm changes persist (SecureStore + API) and appear in subsequent calculations.
11. **Offline cache**: Disable network connectivity, complete a calculation, and press Execute to confirm the DeviceCache retains the executed result. Re-enable connectivity and ensure the calculation syncs into history within the 30-day window without duplicate entries from background refreshes.

## Shutdown
- Stop Expo and Fastify processes.
- Remove or encrypt any temporary ApeX credentials used during testing.
- If a local Supabase/PostgreSQL instance is running, stop the container or service.
