
# Implementation Plan: Centralize Apex Omni Secrets in Google Secret Manager

**Branch**: `002-the-api-app` | **Date**: 2025-11-15 | **Spec**: /Users/booke/dev/nix-expo-ic/apex-tradebill/specs/002-the-api-app/spec.md
**Input**: Feature specification from `/specs/002-the-api-app/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, `QWEN.md` for Qwen Code or `AGENTS.md` for opencode).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Production Apex Omni credentials must live exclusively inside Google Secret Manager (GSM) so the Fastify API never relies on environment variables or code-embedded secrets. The plan introduces a typed `OmniSecretCache` that hydrates secrets from GSM at startup, refreshes every five minutes or on-demand, exposes observability endpoints/metrics, and supports an audited break-glass workflow when GSM is unavailable. Operator-facing endpoints and metadata tables enforce the fixed secret catalog, annual rotation policy, and >=99.9% availability / p95≤1s retrieval budget from the spec.

## Technical Context
**Language/Version**: TypeScript 5.9 targeting Node.js 22 (Fastify API workstation)  
**Primary Dependencies**: Fastify 5, `@google-cloud/secret-manager`, `apexomni-connector-node`, Pino logger, Postgres + `pg` driver  
**Storage**: Google Secret Manager for secret material; Postgres for metadata/access logs  
**Testing**: Jest 29 with ts-jest + Supertest for HTTP flows  
**Target Platform**: Linux containers (Cloud Run/GKE) with Workload Identity enabled  
**Project Type**: Mobile + API monorepo (apps/mobile, apps/api)  
**Performance Goals**: GSM retrievals maintain >=99.9% monthly availability and ≤1s p95 latency; cache refresh <500ms per secret; alerts fire within 2 minutes of sustained failures  
**Constraints**: GSM only in production, sanitized values for lower environments, rotation ≤1/year unless compromised, break-glass TTL ≤30 minutes, Omni routes degrade instead of crashing API  
**Scale/Scope**: Fixed catalog of 3 Apex Omni secrets, <10 secret reads per minute, ≤90 days of audit log retention

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Initial Constitution Check (Pre-Design)
- **Financial Data Integrity**: Secret metadata includes rotation/owner details to preserve traceability; no data duplication outside GSM/Postgres.  
- **Risk Management Discipline**: Annual rotation cap + break-glass TTL ensures exposure windows are defined and auditable.  
- **Code Quality & Simplicity**: Plan isolates functionality into `OmniSecretCache`, CLI, and Fastify routes without extra abstractions.  
- **Test-First & Reliability**: Contract tests + quickstart enforce TDD for secret endpoints and failure handling.  
- **Security & Secrets Protection**: Exclusive GSM usage, IAM-scoped access, and encrypted overrides align with crypto-grade requirements.  
- **Performance & Low-Latency Reliability**: Defined cache TTL and GSM SLOs keep dependency budgets explicit.  
- **Day-Trader UX Consistency**: Not directly impacted (backend-only) but admin flows keep operator steps deterministic.

**Result**: PASS — no constitutional violations prior to research.

## Project Structure

### Documentation (this feature)
```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure]
```

**Structure Decision**: [DEFAULT to Option 1 unless Technical Context indicates web/mobile app]
Structure Decision: **Option 3 – Mobile + API** (Fastify backend + Expo client); only the API service changes in this feature.

## Phase 0: Outline & Research
### Topics Investigated
1. **GSM integration approach** — chose the official `@google-cloud/secret-manager` client with Workload Identity.  
2. **Secret hydration & caching** — designed a 5-minute TTL cache plus `/internal/.../cache/refresh` endpoint to balance latency and rotation responsiveness.  
3. **Observability & Alerting** — defined structured logs + Prometheus metrics feeding Grafana alerts for failures and stale caches.  
4. **Break-glass workflow** — specified a CLI-driven encrypted override capped at 30 minutes.

All findings and alternatives are captured in `/Users/booke/dev/nix-expo-ic/apex-tradebill/specs/002-the-api-app/research.md`.

**Result**: Research complete; no outstanding unknowns.

## Phase 1: Design & Contracts
### Deliverables
- `/specs/002-the-api-app/data-model.md` documents the `OmniSecretMetadata`, `OmniSecretAccessEvent`, and cache-state structures plus transitions for rotations and break-glass usage.  
- `/specs/002-the-api-app/contracts/omni-secrets.openapi.yaml` defines four internal endpoints (status, rotation preview, cache refresh, break-glass).  
- `/specs/002-the-api-app/contracts/tests/*.md` capture failing contract tests for each endpoint so TDD will start with explicit assertions.  
- `/specs/002-the-api-app/quickstart.md` outlines operator and verifier steps covering hydration, rotation, refresh failures, and break-glass flows.  
- `.specify/scripts/bash/update-agent-context.sh codex` executed to capture the updated Fastify + GSM context for downstream agents.

### Post-Design Constitution Check
- **Observability**: Metrics/log coverage satisfies constitution Additional Constraints.  
- **Security**: Exclusive GSM usage plus encrypted break-glass path matches crypto-grade requirements.  
- **Performance**: Cache TTL + SLA numbers keep dependency budgets explicit (≤1s p95).  
- **Reliability**: Partial-degradation path for Omni routes prevents total API outages.

**Result**: PASS — design remains constitutionally compliant.

## Phase 2: Task Planning Approach
The upcoming `/tasks` run will pull from the above artifacts to create ~25 ordered tasks:
- **Contracts → Tests**: Each endpoint gets a Jest contract test task ([P] eligible when independent).  
- **Entities → Persistence**: Metadata + access-event tables/migrations + repository units.  
- **Services → Cache & CLI**: Build `OmniSecretCache`, GSM client wrapper, CLI for break-glass, alert wiring.  
- **Integration → Quickstart Scenarios**: Tasks for cache refresh failure simulation and break-glass verification.  
Execution order will stay TDD-first (write failing tests, implement, refactor) while respecting dependencies (schema → services → routes → CLI → docs). Parallel tags applied where DB and HTTP work are separable.

## Implementation Roadmap
1. **Instrumentation & Schema Prep**
   - Create `OmniSecretMetadata` and `OmniSecretAccessEvent` migrations plus repository helpers.
   - Land telemetry scaffolding (Pino log keys + Prometheus metrics) to keep later steps observable.
   - Extend CI to run automated secrets scanning (e.g., gitleaks) and dependency audits (`pnpm audit`) for `apps/api`, satisfying constitution Security/Test-First mandates.
2. **GSM Client + Cache Layer**
   - Implement the `OmniSecretCache` (startup hydrate, 5-minute TTL, manual refresh hook) along with GSM wrapper + retries.
   - Add degradation logic so Omni routes short-circuit when cache source unavailable (per FR-012).
   - Introduce environment guardrails that prevent non-production builds from referencing production GSM project IDs, failing fast with actionable logs.
3. **Operator & Service Endpoints**
   - Build `/ops/apex-omni/secrets/status`, `/ops/.../rotation-preview`, `/internal/.../cache/refresh`, and `/ops/.../break-glass` against the cache and metadata layers.
   - Ensure break-glass payloads persist encrypted in Postgres with automatic expiration handlers.
4. **CLI & Automation Hooks**
   - Deliver the `pnpm api breakglass:omni` CLI that packages ciphertext and posts to the break-glass endpoint.
   - Provide helper scripts (if needed) to trigger cache refresh or rotation preview with canned values.
5. **Validation & Runbooks**
   - Execute quickstart steps end-to-end (hydration, rotation preview, failure simulation, break-glass).
   - Update runbooks/alerts to reference the new Prometheus metrics, rotation-overdue alerts, and log search patterns.

Each roadmap step corresponds to one or more future `/tasks` entries and preserves the constitution's emphasis on TDD, observability, and security.

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| _None_ | — | — |


## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none)

---
*Based on Constitution - See `.specify/memory/constitution.md`*
