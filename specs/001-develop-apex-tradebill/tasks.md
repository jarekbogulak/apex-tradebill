# Tasks: Apex TradeBill Trading Companion

**Input**: Design documents from `/specs/001-develop-apex-tradebill/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/openapi.yaml, quickstart.md

## Execution Flow (main)
```
1. Load plan.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md from the feature directory
   → If any required doc missing: halt and restore prerequisites from spec commit 001-develop-apex-tradebill
2. Derive models/entities from data-model.md and DTO sections
3. Derive endpoints and expected payloads from contracts/openapi.yaml
4. Map user stories from quickstart.md to integration test cases
5. Generate ordered tasks using this template, ensuring tests precede implementation and dependencies are explicit
6. Validate coverage: every contract, entity, endpoint, and user story must have a task
7. Persist tasks.md and share execution guidance
```

## Phase 3.1: Setup
- [x] T001 Set up a monorepo according to the documentaion under README.md and the following URL: https://docs.expo.dev/guides/monorepos/; in particular, create pnpm workspace + root tooling scripts aligning mobile, api, and packages
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/pnpm-workspace.yaml, /Users/booke/dev/nix-expo-ic/apex-tradebill/package.json
- [x] T002 Scaffold Expo managed app shell with Default template so `mobile/` matches Expo SDK 54 expectations following the documentaion under the URL: https://docs.expo.dev/guides/monorepos/
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/mobile/app.json, /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/mobile/app/(tabs)/index.tsx
  - Depends on: None
- [x] T003 Initialize Fastify Node service skeleton with entry point and scripts
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api/package.json, /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api/src/server.ts
  - Depends on: None
- [x] T004 Establish shared TypeScript config and project references across workspace
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/tsconfig.base.json, /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/mobile/tsconfig.json, /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api/tsconfig.json
  - Depends on: T002, T003
- [ ] T005 [P] Bootstrap `packages/types` workspace module for shared DTOs and contracts
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/packages/types/package.json, /Users/booke/dev/nix-expo-ic/apex-tradebill/packages/types/src/index.ts
  - Depends on: T002, T003
- [ ] T006 [P] Bootstrap `packages/utils` workspace module for isomorphic helpers
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/packages/utils/package.json, /Users/booke/dev/nix-expo-ic/apex-tradebill/packages/utils/src/index.ts
  - Depends on: T002, T003
- [ ] T007 [P] Bootstrap `packages/ui` workspace module for shared Expo components
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/packages/ui/package.json, /Users/booke/dev/nix-expo-ic/apex-tradebill/packages/ui/src/index.tsx
  - Depends on: T002, T003
- [ ] T008 Configure linting, formatting, and pnpm scripts for monorepo guardrails
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/configs/eslint/.eslintrc.cjs, /Users/booke/dev/nix-expo-ic/apex-tradebill/.prettierrc.cjs
  - Depends on: T002, T003
- [ ] T009 Double-check (do not make any changes) Metro and Babel to ensure they transpile workspace packages for Expo
- [ ] T010 Author shared Jest configuration (API + mobile) with Testing Library presets
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/configs/jest/jest.config.base.ts, /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/mobile/jest.config.ts, /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api/jest.config.ts
  - Depends on: T002, T003

## Phase 3.2: Tests First (TDD)
- [ ] T011 [P] Scaffold contract test for GET /v1/markets/{symbol} validating schema from contracts/openapi.yaml
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/tests/contract/markets/get-markets.contract.test.ts, /Users/booke/dev/nix-expo-ic/apex-tradebill/specs/001-develop-apex-tradebill/contracts/openapi.yaml
  - Depends on: T010
- [ ] T012 [P] Scaffold contract test for POST /v1/trades/preview covering happy path and validation errors
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/tests/contract/trades/post-preview.contract.test.ts, /Users/booke/dev/nix-expo-ic/apex-tradebill/specs/001-develop-apex-tradebill/contracts/openapi.yaml
  - Depends on: T010
- [ ] T013 [P] Scaffold contract test for GET /v1/trades/history enforcing pagination contract
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/tests/contract/trades/get-history.contract.test.ts, /Users/booke/dev/nix-expo-ic/apex-tradebill/specs/001-develop-apex-tradebill/contracts/openapi.yaml
  - Depends on: T010
- [ ] T014 [P] Scaffold contract test for GET /v1/settings validating defaults payload
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/tests/contract/settings/get-settings.contract.test.ts, /Users/booke/dev/nix-expo-ic/apex-tradebill/specs/001-develop-apex-tradebill/contracts/openapi.yaml
  - Depends on: T010
- [ ] T015 [P] Scaffold contract test for PATCH /v1/settings covering allowed mutations and validation errors
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/tests/contract/settings/patch-settings.contract.test.ts, /Users/booke/dev/nix-expo-ic/apex-tradebill/specs/001-develop-apex-tradebill/contracts/openapi.yaml
  - Depends on: T010
- [ ] T016 [P] Scaffold contract test for GET /v1/accounts/equity covering connected vs manual responses
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/tests/contract/accounts/get-equity.contract.test.ts, /Users/booke/dev/nix-expo-ic/apex-tradebill/specs/001-develop-apex-tradebill/contracts/openapi.yaml
  - Depends on: T010
- [ ] T017 [P] Scaffold contract test for WebSocket /v1/stream/market-data handshake and payload schema
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/tests/contract/stream/market-data.contract.test.ts, /Users/booke/dev/nix-expo-ic/apex-tradebill/specs/001-develop-apex-tradebill/contracts/openapi.yaml
  - Depends on: T010
- [ ] T018 [P] Author integration test for "Live sizing (stub)" quickstart flow
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/tests/integration/mobile/live-sizing-stub.spec.ts, /Users/booke/dev/nix-expo-ic/apex-tradebill/specs/001-develop-apex-tradebill/quickstart.md
  - Depends on: T010
- [ ] T019 [P] Author integration test for "Live sizing (real feed)" resilience scenario
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/tests/integration/mobile/live-sizing-realfeed.spec.ts, /Users/booke/dev/nix-expo-ic/apex-tradebill/specs/001-develop-apex-tradebill/quickstart.md
  - Depends on: T010
- [ ] T020 [P] Author integration test for volatility multiplier presets updating outputs
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/tests/integration/mobile/volatility-multiplier.spec.ts, /Users/booke/dev/nix-expo-ic/apex-tradebill/specs/001-develop-apex-tradebill/quickstart.md
  - Depends on: T010
- [ ] T021 [P] Author integration test for validation error UX on invalid stop/target inputs
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/tests/integration/mobile/validation-errors.spec.ts, /Users/booke/dev/nix-expo-ic/apex-tradebill/specs/001-develop-apex-tradebill/quickstart.md
  - Depends on: T010
- [ ] T022 [P] Author integration test for stale fallback and reconnect backoff signals
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/tests/integration/mobile/stale-fallback.spec.ts, /Users/booke/dev/nix-expo-ic/apex-tradebill/specs/001-develop-apex-tradebill/quickstart.md
  - Depends on: T010
- [ ] T023 [P] Author integration test for equity sync between connected and manual sources
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/tests/integration/mobile/equity-sync.spec.ts, /Users/booke/dev/nix-expo-ic/apex-tradebill/specs/001-develop-apex-tradebill/quickstart.md
  - Depends on: T010
- [ ] T024 [P] Author integration test for trade history retention (30-day pruning)
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/tests/integration/api/history-retention.spec.ts, /Users/booke/dev/nix-expo-ic/apex-tradebill/specs/001-develop-apex-tradebill/quickstart.md
  - Depends on: T010
- [ ] T065 [P] Add property-based tests covering ATR(13) calculator invariants (monotonic volatility, non-negative outputs, rounding floors)
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api/src/services/calculations/__tests__/atrCalculator.property.test.ts
  - Depends on: T010, T030
- [ ] T066 [P] Add property-based tests verifying trade preview sizing respects percent-risk caps and symbol precision
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api/src/services/trades/__tests__/tradePreview.property.test.ts
  - Depends on: T010, T030, T031
- [ ] T067 [P] Author integration test for risk visualization keeping entry/stop/target ratios in sync with live updates
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/tests/integration/mobile/risk-visualization.spec.ts, /Users/booke/dev/nix-expo-ic/apex-tradebill/specs/001-develop-apex-tradebill/quickstart.md
  - Depends on: T010, T018, T019, T020
- [ ] T068 [P] Author integration test for settings panel defaults, edits, and persistence
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/tests/integration/mobile/settings-panel.spec.ts, /Users/booke/dev/nix-expo-ic/apex-tradebill/specs/001-develop-apex-tradebill/quickstart.md
  - Depends on: T010, T023
- [ ] T069 [P] Add unit tests for locale-aware formatting and contrast tokens
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/packages/utils/src/__tests__/formatting.spec.ts
  - Depends on: T010, T006

- [ ] T074 [P] Add contract/property tests enforcing ApeX symbol allowlist handling for market endpoints and configuration updates
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/tests/contract/markets/symbol-allowlist.contract.test.ts, /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api/src/services/markets/__tests__/marketAllowlist.property.test.ts
  - Depends on: T010, T011
- [ ] T076 [P] Add rounding and precision tests covering tick size floors, cent rounding, and risk-to-reward outputs
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/packages/utils/src/__tests__/roundingRules.spec.ts, /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api/src/services/trades/__tests__/previewRounding.property.test.ts
  - Depends on: T010, T030
- [ ] T078 [P] Add scheduler tests ensuring 1s recompute cadence and telemetry alerts when thresholds are breached
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/tests/integration/api/recompute-cadence.spec.ts, /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/mobile/src/features/stream/__tests__/refreshScheduler.test.ts
  - Depends on: T010, T022
- [ ] T080 [P] Add property tests validating price sampling selects the latest tick per window and carries forward when idle
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api/src/realtime/__tests__/priceSampling.property.test.ts
  - Depends on: T010, T017
- [ ] T082 Add reliability monitoring tests covering 99.5% availability alert thresholds and reporting
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/tests/reliability/uptime-monitor.spec.ts
  - Depends on: T010, T062


## Phase 3.3: Core Implementation (after tests are failing)
- [ ] T025 [P] Implement User model with Zod validation and repository helpers
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api/src/domain/user/user.entity.ts
  - Depends on: T011, T012, T013, T014, T015, T016, T017, T018, T019, T020, T021, T022, T023, T024
- [ ] T026 [P] Implement UserSettings model including defaults and constraints
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api/src/domain/user-settings/user-settings.entity.ts
  - Depends on: T011, T012, T013, T014, T015, T016, T017, T018, T019, T020, T021, T022, T023, T024
- [ ] T027 [P] Implement ConnectedAccount model with status transition enforcement
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api/src/domain/connected-account/connected-account.entity.ts
  - Depends on: T011, T012, T013, T014, T015, T016, T017, T018, T019, T020, T021, T022, T023, T024
- [ ] T028 [P] Implement TradeCalculation model persisting JSONB input/output payloads
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api/src/domain/trade-calculation/trade-calculation.entity.ts
  - Depends on: T011, T012, T013, T014, T015, T016, T017, T018, T019, T020, T021, T022, T023, T024
- [ ] T029 [P] Implement DeviceCacheEntry storage for Expo offline cache maintenance
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/mobile/src/storage/device-cache-entry.ts
  - Depends on: T011, T012, T013, T014, T015, T016, T017, T018, T019, T020, T021, T022, T023, T024
- [ ] T030 [P] Define shared TradeInput/TradeOutput/MarketSnapshot DTOs exported from types package
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/packages/types/src/trading.ts
  - Depends on: T005, T011, T012, T013, T014, T015, T016, T017, T018, T019, T020, T021, T022, T023, T024
- [ ] T031 [P] Define domain ports for market data, equity, and settings interactions
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api/src/domain/ports/tradebillPorts.ts
  - Depends on: T030
- [ ] T032 [P] Implement deterministic ATR(13) calculator module consumed by trade preview logic
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api/src/services/calculations/atrCalculator.ts
  - Depends on: T030, T065
- [ ] T033 [P] Implement trade preview service orchestrating validation, ATR calculator, and warnings
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api/src/services/trades/previewService.ts
  - Depends on: T028, T030, T031, T032, T066
- [ ] T077 [P] Wire rounding and precision helpers into trade preview responses and shared DTO serialization
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/packages/utils/src/rounding.ts, /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api/src/services/trades/previewService.ts
  - Depends on: T076, T033
- [ ] T034 [P] Implement trade history service with pagination and retention boundaries
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api/src/services/trades/historyService.ts
  - Depends on: T028, T031
- [ ] T035 [P] Implement settings service enforcing bounds from data-model
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api/src/services/settings/settingsService.ts
  - Depends on: T025, T026, T031
- [ ] T036 [P] Implement account equity service covering connected and manual flows
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api/src/services/accounts/equityService.ts
  - Depends on: T027, T031
- [ ] T037 [P] Implement market metadata service sourcing tick/step sizing
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api/src/services/markets/marketMetadataService.ts
  - Depends on: T031
- [ ] T075 [P] Implement ApeX symbol allowlist enforcement and configuration surfaces for market metadata
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api/src/services/markets/marketMetadataService.ts, /Users/booke/dev/nix-expo-ic/apex-tradebill/configs/markets/allowlist.json
  - Depends on: T074, T037
- [ ] T038 [P] Create Zustand store for persisted user settings with Expo SecureStore hydration
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/mobile/src/state/settingsStore.ts
  - Depends on: T009, T030
- [ ] T039 [P] Create Zustand store for trade calculator inputs/outputs and selectors
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/mobile/src/state/tradeCalculatorStore.ts
  - Depends on: T030
- [ ] T040 [P] Author shared API client utilities for Fastify endpoints with TanStack Query integration
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/mobile/src/services/apiClient.ts
  - Depends on: T030, T011, T012, T013, T014, T015, T016, T017
- [ ] T041 [P] Build Expo trade calculator screen binding stores, queries, and validation states
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/mobile/app/(tabs)/trade-calculator.tsx
  - Depends on: T038, T039, T040, T018, T019, T020, T021, T070, T072
- [ ] T042 [P] Compose trade history list UI with pagination and retry controls
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/mobile/src/features/history/HistoryList.tsx
  - Depends on: T039, T040, T024
- [ ] T043 [P] Create market data stream hook with stale detection and reconnect logic
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/mobile/src/features/stream/useMarketStream.ts
  - Depends on: T040, T022
- [ ] T079 [P] Implement 1s recompute scheduler modules with telemetry hooks for client and server refresh loops
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/mobile/src/features/stream/refreshScheduler.ts, /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api/src/realtime/refreshScheduler.ts
  - Depends on: T078, T043, T050
- [ ] T070 [P] Build risk visualization component with accessible contrast and live updates
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/mobile/src/features/visualization/RiskVisualization.tsx
  - Depends on: T039, T040, T067
- [ ] T071 [P] Build settings panel screen and navigation entry point
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/mobile/app/(tabs)/settings.tsx
  - Depends on: T038, T039, T040, T068
- [ ] T072 [P] Implement formatting and accessibility utilities consumed by UI components
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/packages/utils/src/formatting.ts
  - Depends on: T006, T069

## Phase 3.4: Endpoint Implementation (after services are ready)
- [ ] T044 Implement Fastify route for GET /v1/markets/{symbol} with schema validation
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api/src/routes/markets/getSymbol.ts
  - Depends on: T037, T011
- [ ] T045 Implement Fastify route for POST /v1/trades/preview producing TradeOutput payload
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api/src/routes/trades/postPreview.ts
  - Depends on: T033, T012
- [ ] T046 Implement Fastify route for GET /v1/trades/history with cursor pagination
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api/src/routes/trades/getHistory.ts
  - Depends on: T034, T013
- [ ] T047 Implement Fastify route for GET /v1/settings returning persisted defaults
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api/src/routes/settings/getSettings.ts
  - Depends on: T035, T014
- [ ] T048 Implement Fastify route for PATCH /v1/settings applying partial updates
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api/src/routes/settings/patchSettings.ts
  - Depends on: T035, T015
- [ ] T049 Implement Fastify route for GET /v1/accounts/equity normalizing sources
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api/src/routes/accounts/getEquity.ts
  - Depends on: T036, T016
- [ ] T050 Implement WebSocket upgrade handler for /v1/stream/market-data publishing snapshots
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api/src/routes/stream/marketData.ts
  - Depends on: T033, T043, T017

## Phase 3.5: Integration
- [ ] T051 Configure PostgreSQL connection pool and migration scaffolding for core entities
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api/src/infra/database/pool.ts, /Users/booke/dev/nix-expo-ic/apex-tradebill/configs/db/migrations/README.md
  - Depends on: T025, T026, T027, T028, T034
- [ ] T052 Implement nightly trade history retention job enforcing 30-day window
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api/src/jobs/pruneTradeHistory.ts
  - Depends on: T051, T028, T024
- [ ] T053 Implement ApeX Omni SDK client wrapper encapsulating REST + WebSocket auth
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api/src/clients/apexOmniClient.ts
  - Depends on: T031
- [ ] T054 Implement in-process ring buffer adapter for market snapshots
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api/src/realtime/ringBuffer.ts
  - Depends on: T053, T032
- [ ] T055 Wire market stream gateway plugin to Fastify lifecycle
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api/src/plugins/marketStream.ts
  - Depends on: T050, T054
- [ ] T081 [P] Implement price window sampling in ring buffer and stream publisher enforcing latest-tick-per-second rules
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api/src/realtime/ringBuffer.ts, /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api/src/routes/stream/marketData.ts
  - Depends on: T080, T054, T055
- [ ] T056 Add authentication middleware with JWT validation and SecureStore coordination
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api/src/plugins/authentication.ts
  - Depends on: T002, T025, T027
- [ ] T057 Add structured logging and metrics instrumentation covering latency percentiles, error rates, calculation volume, reconnect success, and crash reporting
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api/src/plugins/observability.ts
  - Depends on: T002
- [ ] T083 Configure uptime metrics pipeline and alerting dashboards enforcing the 99.5% availability target
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/configs/observability/uptime.yml, /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api/src/plugins/observability.ts
  - Depends on: T082, T057
- [ ] T058 Implement Expo offline cache sync worker bridging DeviceCacheEntry to API history
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/mobile/src/sync/cacheSync.ts
  - Depends on: T029, T042, T024
- [ ] T059 Implement stale state banner and reconnect UI instrumentation
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/mobile/src/features/stream/StaleBanner.tsx
  - Depends on: T043, T022

## Phase 3.6: Polish
- [ ] T060 [P] Add unit tests for ATR calculator edge cases and regression protection
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api/src/services/calculations/__tests__/atrCalculator.test.ts
  - Depends on: T032
- [ ] T061 [P] Add unit tests for trade calculator Zustand store selectors
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/mobile/src/state/__tests__/tradeCalculatorStore.test.ts
  - Depends on: T039
- [ ] T062 Add latency smoke/performance test harness verifying p95 budgets
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/tests/performance/latency-smoke.test.ts
  - Depends on: T055, T024
- [ ] T073 Add Expo performance profiling script capturing frame-rate compliance for calculator flows
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/tests/performance/mobile-fps.profile.ts
  - Depends on: T041, T070, T072
- [ ] T063 [P] Document end-to-end setup and troubleshooting in docs/apex-tradebill.md
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/docs/apex-tradebill.md
  - Depends on: T044, T045, T046, T047, T048, T049, T050, T051, T052, T053, T054, T055, T056, T057, T058, T059
- [ ] T064 Configure security scanning and dependency audit automation
  - Files: /Users/booke/dev/nix-expo-ic/apex-tradebill/configs/security/.spectral.yaml, /Users/booke/dev/nix-expo-ic/apex-tradebill/package.json
  - Depends on: T008

## Dependencies
- Setup (T001–T010) must complete before any tests start
- Contract and integration/property tests (T011–T024, T065–T069, T074, T076, T078, T080, T082) must exist and fail before implementing models/services/routes
- Models (T025–T029) block services (T030–T037), which block routes (T044–T050)
- Integration plumbing (T051–T059) requires routes and services to be in place
- Polish (T060–T064) runs last after core functionality is wired

## Parallel Example
```
# Example parallel batch after setup completes:
(task-agent run T011 &) && (task-agent run T012 &) && (task-agent run T013 &) && (task-agent run T014 &) && (task-agent run T015 &) && (task-agent run T016 &) && (task-agent run T017 &)
wait

# Example parallel batch for entity models once tests exist:
(task-agent run T025 &) && (task-agent run T026 &) && (task-agent run T027 &) && (task-agent run T028 &) && (task-agent run T029 &)
wait
```

## Validation Checklist
- [ ] Every endpoint in contracts/openapi.yaml has a contract test and implementation task
- [ ] Every entity in data-model.md has a model task flagged [P]
- [ ] Every quickstart acceptance scenario has an integration test task
- [ ] Tests (T011–T024) precede all implementation work
- [ ] Parallel tasks only touch distinct files or directories
- [ ] Logging, metrics, authentication, retention, and offline sync tasks are present
- [ ] Documentation and security/audit polish tasks are queued for the final phase
