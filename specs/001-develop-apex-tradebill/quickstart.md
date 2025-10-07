# Phase 1 Quickstart – Apex TradeBill

## Prerequisites
- Node.js 22.x and pnpm 9 installed on the workstation
- Expo CLI tooling available (`npx expo start --version` > 6)
- Xcode (iOS 16+ simulator) or Android Studio (Android 13+ emulator) for Expo testing
- Optional for later phases: Docker or local PostgreSQL 16 once persistence tasks land

## Bootstrap (Stage 1 – Skeleton)
1. `npx create-expo-app@latest mobile --template blank-typescript` (runs inside repo root; generates `mobile/`).
2. `pnpm init -y` inside `api/` followed by `pnpm add fastify ws typescript tsx` to scaffold the Node service stub.
3. From repo root, create a workspace `pnpm-workspace.yaml` (Task 001) so both `mobile` and `api` share dependencies; then run `pnpm install`.
4. Copy `.env.example` → `.env` in `api/` once the environment template is authored (tasks TBD). Leave ApeX credentials empty until we wire the SDK.

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
4. **Validation**: Enter invalid stop/target (e.g., stop above entry on long) and ensure calculation is blocked with explicit error labels.
5. **Stale fallback**: Simulate feed outage (pause the ApeX client); check UI shows “Stale,” reconnect backoff indicators, and manual price entry unlocks.
6. **Equity sync**: Switch between connected equity and manual entry; confirm labeling and audit trail entries align with the constitution.
7. **History retention**: Once PostgreSQL writes are enabled, ensure only the most recent 30 days of trade calculations appear and older entries prune in nightly jobs.
8. **Risk visualization**: Interact with the calculator while watching the visualization panel; verify entry/stop/target markers stay in sync with numerical outputs, use accessible contrast (WCAG AA), and do not reorder.
9. **Settings panel**: Open the settings screen, update risk %, ATR multiplier, and freshness threshold, then confirm changes persist (SecureStore + API) and appear in subsequent calculations.
10. **Offline cache**: Disable network connectivity, complete a calculation, and confirm the DeviceCache retains the result. Re-enable connectivity and ensure the calculation syncs into history within the 30-day window.

## Shutdown
- Stop Expo and Fastify processes.
- Remove or encrypt any temporary ApeX credentials used during testing.
- If PostgreSQL is running locally, stop the container or service.
