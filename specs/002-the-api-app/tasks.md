# Tasks: Centralize Apex Omni Secrets in Google Secret Manager

**Input**: Design documents from `/specs/002-the-api-app/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/, quickstart.md

## Execution Flow (main)
```
1. Load plan.md from feature directory (tech stack + roadmap)
2. Read supporting docs (research, data-model, contracts, quickstart)
3. Generate ordered tasks (setup → tests → models → services → endpoints → integration → polish)
4. Mark [P] when tasks touch different files and have no dependency conflicts
5. Number tasks sequentially (T001…)
6. Describe dependencies + parallel execution guidance
```

## Phase 3.1: Setup
- [X] T001 Update `apps/api/package.json` and `pnpm-lock.yaml` to add `@google-cloud/secret-manager`, `prom-client`, and `tweetnacl-ts`, then expose `GCP_PROJECT_ID`, `OMNI_BREAKGLASS_PUBLIC_KEY`, and `OMNI_CACHE_TTL_SECONDS` via `apps/api/src/config/env.ts`.
- [X] T002 Document required GSM IAM roles plus new env vars in `apps/api/.env.example` and `apps/api/README.md` (startup instructions + failure modes).
- [X] T003 [P] Create Jest/Supertest harness `apps/api/tests/setup/omniTestContext.ts` and register it in `apps/api/jest.config.cjs` so Omni contract/integration suites share Fastify + GSM mocks.
- [X] T004 Configure CI to run automated secrets scanning (e.g., gitleaks) and dependency audits (`pnpm audit`) for `apps/api`, documenting these guards in `apps/api/README.md` with references to constitution Security/Test-First principles.

## Phase 3.2: Tests First (TDD)
- [X] T005 [P] Author failing contract test for `GET /ops/apex-omni/secrets/status` in `apps/api/tests/contracts/omniStatus.contract.test.ts` that asserts auth scope, metadata response, and hidden secret values.
- [X] T006 [P] Author failing contract test for `POST /ops/apex-omni/secrets/rotation-preview` in `apps/api/tests/contracts/omniRotationPreview.contract.test.ts` covering happy path + 409 conflict.
- [X] T007 [P] Author failing contract test for `POST /internal/apex-omni/secrets/cache/refresh` in `apps/api/tests/contracts/omniCacheRefresh.contract.test.ts` ensuring targeted/all refresh behavior and queued request IDs.
- [X] T008 [P] Author failing contract test for `POST /ops/apex-omni/secrets/break-glass` in `apps/api/tests/contracts/omniBreakGlass.contract.test.ts` enforcing TTL <=30m and audit log emission.
- [X] T009 [P] Add integration test `apps/api/tests/integration/omniMetadataSeed.int.test.ts` that runs the new seed script and asserts `OmniSecretMetadata` rows + rotation deadlines exist.
- [X] T010 [P] Add integration test `apps/api/tests/integration/omniCacheHydration.int.test.ts` simulating server startup to verify GSM fetch happens <1s and Omni routes degrade when cache empty per FR-012.
- [X] T011 [P] Add integration test `apps/api/tests/integration/omniRotationFlow.int.test.ts` covering rotation preview success and conflict (busy status) with mocked GSM responses.
- [X] T012 [P] Add integration test `apps/api/tests/integration/omniCacheFailure.int.test.ts` that stubs GSM outage, expects cache refresh endpoint to emit alerts/logs, and ensures Omni endpoints return 503.
- [X] T013 [P] Add integration test `apps/api/tests/integration/omniBreakGlassFlow.int.test.ts` invoking the CLI helper to push a ciphertext and asserting `/ops/.../status` returns `cacheSource="break_glass"` until TTL expiry.
- [X] T014 [P] Add integration test `apps/api/tests/integration/omniEnvGuards.int.test.ts` proving non-production configs pointing at production GSM IDs fail startup with explicit errors and logs.
- [X] T015 [P] Add integration test `apps/api/tests/integration/omniRotationPolicy.int.test.ts` simulating overdue metadata and asserting rotation monitors emit alerts/log entries before the 12-month window elapses.

## Phase 3.3: Core Implementation
- [ ] T016 [P] Create migration `apps/api/src/db/migrations/2025111501_create_omni_secret_metadata.ts` defining the `OmniSecretMetadata` table (unique secret type, rotation fields, break-glass timestamp).
- [ ] T017 [P] Create migration `apps/api/src/db/migrations/2025111502_create_omni_secret_access_events.ts` for the audit table capturing action, actor, result, and duration_ms.
- [ ] T018 [P] Implement seed script `apps/api/src/scripts/seedOmniSecrets.ts` plus `package.json` script `db:seed:omni-secrets` that inserts the predefined catalog.
- [ ] T019 [P] Define domain types + Zod validators for `OmniSecretMetadata`, `OmniSecretAccessEvent`, and `OmniSecretCacheState` in `apps/api/src/modules/omniSecrets/types.ts`.
- [ ] T020 Build repository helpers in `apps/api/src/modules/omniSecrets/repository.ts` (CRUD for metadata + append-only access-event logger) wired to the new tables.
- [ ] T021 Implement `GsmSecretManagerClient` wrapper in `apps/api/src/modules/omniSecrets/gsmClient.ts` with Workload Identity auth, retries, and metrics hooks.
- [ ] T022 Implement `OmniSecretCache` in `apps/api/src/modules/omniSecrets/cache.ts` (startup hydrate, 5-minute TTL, manual refresh, break-glass override, emitting cache events).
- [ ] T023 Implement `OmniSecretService` in `apps/api/src/modules/omniSecrets/service.ts` orchestrating metadata, GSM reads, cache refresh, status summaries, and FR-012 degrade handling.
- [ ] T024 Implement environment guard logic (config validator or service hook) in `apps/api/src/modules/omniSecrets/service.ts` that rejects mismatched environment/GSM project pairs and logs constitution references.
- [ ] T025 Build CLI `apps/api/src/scripts/breakglassOmni.ts` that encrypts payloads with the API public key, posts to `/ops/apex-omni/secrets/break-glass`, and validates TTL <=30m.
- [ ] T026 Implement Fastify route module `apps/api/src/routes/ops/apexOmni/status.ts` wiring GET `/ops/apex-omni/secrets/status` to `OmniSecretService.status()` and hiding secret values.
- [ ] T027 Implement Fastify route module `apps/api/src/routes/ops/apexOmni/rotationPreview.ts` wiring POST `/ops/.../rotation-preview` to service validation logic + conflict guard.
- [ ] T028 Implement Fastify route module `apps/api/src/routes/internal/apexOmni/cacheRefresh.ts` wiring POST `/internal/.../cache/refresh` to schedule refresh work and emit events.
- [ ] T029 Implement Fastify route module `apps/api/src/routes/ops/apexOmni/breakGlass.ts` to persist ciphertext payloads, update metadata, and schedule auto-expiry handling.
- [ ] T030 Add scheduled rotation monitor in `apps/api/src/jobs/omniRotationMonitor.ts` (or equivalent) that scans `rotation_due_at`, emits alerts/logs for overdue entries, and exposes status via metrics.

## Phase 3.4: Integration & Observability
- [ ] T031 Register an `omniSecrets` Fastify plugin in `apps/api/src/plugins/omniSecrets.ts` and mount it from `apps/api/src/server.ts`, injecting service + cache instances via DI and exposing health/readiness hooks.
- [ ] T032 Add structured logging + Prometheus metrics in `apps/api/src/observability/omniSecretsTelemetry.ts` (counters `omni_secret_reads_total`, `omni_secret_failures_total`, cache age gauge, rotation-overdue gauge) and export them through the existing metrics endpoint.
- [ ] T033 Wire `OmniSecretAccessEvent` publishing + alert hooks in `apps/api/src/observability/alerts/omniSecrets.ts` so consecutive failures or overdue rotations trigger PagerDuty/Grafana rules per spec.
- [ ] T034 Update Fastify error handling in `apps/api/src/plugins/errorHandler.ts` to map Omni-specific errors to 503/422 with explicit JSON payloads and log correlation IDs.
- [ ] T035 Document and expose manual cache refresh + break-glass + rotation-monitor runbooks in `apps/api/docs/omni-secrets.md`, referencing new metrics and CLI usage.

## Phase 3.5: Polish & Validation
- [ ] T036 [P] Add unit tests for `GsmSecretManagerClient` retry/backoff logic in `apps/api/tests/unit/gsmClient.test.ts` (mocking Google SDK).
- [ ] T037 [P] Add unit tests for `OmniSecretCache` expiry + break-glass precedence in `apps/api/tests/unit/omniSecretCache.test.ts`.
- [ ] T038 Validate Quickstart steps by following `specs/002-the-api-app/quickstart.md`, capturing evidence in `apps/api/docs/verification/omni-secrets.md` and updating screenshots/log snippets.
- [ ] T039 [P] Run full test + lint suite (`pnpm lint && pnpm test --filter=apps/api`) and update `apps/api/CHANGELOG.md` with summary + Constitution references.

## Dependencies
- Setup (T001-T004) must finish before any tests or implementation.
- Contract + integration tests (T005-T015) must exist and fail before migrations/services (T016+).
- Migrations (T016-T018) must run before repositories/services (T020-T023).
- Service + cache (T021-T023) plus environment guard (T024) must exist before CLI and routes (T025-T029).
- Rotation monitor (T030) depends on repository/service availability.
- Fastify plugin + telemetry (T031-T035) depend on service + routes.
- Documentation + validation tasks (T035-T039) occur after implementation.

## Parallel Execution Examples
```
# Example 1: write all contract tests together once setup is done
spec/task-agent run T005 T006 T007 T008

# Example 2: after migrations, build repositories + cache types concurrently
spec/task-agent run T019 T020 T021

# Example 3: polish unit tests can run alongside final verification
spec/task-agent run T036 T037 T039
```

## Notes
- [P] tasks touch distinct files with no ordering constraints.
- Always verify new tests fail before implementing routes/services.
- Keep Constitution requirements in mind: no secrets in repo, explicit logging/metrics, deterministic risk controls, and enforced rotation cadence.
