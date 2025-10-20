
# Implementation Plan: Apex TradeBill Trading Companion

**Branch**: `001-develop-apex-tradebill` | **Date**: 2025-09-25 | **Spec**: /Users/booke/dev/nix-expo-ic/apex-tradebill/specs/001-develop-apex-tradebill/spec.md
**Input**: Feature specification from /Users/booke/dev/nix-expo-ic/apex-tradebill/specs/001-develop-apex-tradebill/spec.md

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
Apex TradeBill delivers fast, mobile-first trade sizing that fuses live ApeX Omni market data with configurable risk controls so day traders instantly see position size, risk exposure, and risk-to-reward scenarios. We will build an Expo-managed React Native client backed by a Node.js service that wraps the Apex Omni OpenAPI SDK for streaming prices, deterministic ATR calculations, and persistence of audit-friendly trade snapshots.

## Technical Context
**Language/Version**: TypeScript 5.9 + Expo SDK 54 (React Native 0.81) client + Node.js 22 LTS service layer  
**Primary Dependencies**: Expo 54 managed workflow, Expo Router 3, TanStack Query 5, Zustand 5, Apex Omni OpenAPI Node SDK, Fastify 5 + `ws` 8 streaming  
**Storage**: Supabase-managed (or self-hosted) PostgreSQL 16 for user profiles/trade history + in-process ring buffer for market ticks (Redis upgrade deferred until scaling requires it). We commit to standard SQL features only to preserve portability.  
**Testing**: Jest 30 with phased suites (API/unit + RN smoke initially; contract/property/latency harnesses added after core endpoints land); colocate module-level tests with source, keep cross-cutting suites under `/tests/**`  
**Target Platform**: Expo-managed app for iOS 16+, Android 13+, and responsive Expo web build targeting Chromium-compatible browsers  
**Project Type**: mobile (Expo client + Node.js API service)  
**Performance Goals**: Live price-to-output refresh median ≤250 ms, p95 ≤500 ms; UI ≥55 FPS for 95 % of interaction windows; reconnect within 5 s for 99 % of transient outages  
**Constraints**: Enforce 2 s data freshness, deterministic ATR(13) sizing, secrets confined to secure storage, offline fallback with cached calculations/manual pricing, audit trail for all calculations  
**Scale/Scope**: Launch with BTC-USDT and ETH-USDT on ApeX Omni, ~100 active day traders, retain 30 days of trade snapshots with pruning  
**Additional User Context**: No supplemental command arguments were supplied (verified before planning)

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Financial Data Integrity** → Source streaming + REST data exclusively from the ApeX Omni SDK with signature validation, stamp every tick with server time, and persist full input/output vectors in Supabase-hosted PostgreSQL for audit replay. We avoid Supabase-only extensions so data can migrate to vanilla Postgres if necessary. Planned API schema rejects stale (>2 s) payloads and surfaces explicit error codes.
- **Risk Management Discipline** → Centralize ATR sizing, percent-risk caps, and minimum stop logic inside shared calculator modules; document deterministic formulas now and layer property-based validation once baseline sizing endpoints ship. Backend enforces caps before returning trade sizing responses.
- **Code Quality & Simplicity** → Adopt modular TypeScript (shared `lib/calculations`, `lib/validation`) with strict ESLint/TypeScript configs, avoid speculative abstractions, and document exported calculators. Keep scope tight while enabling later extensions.
- **Test-First & Reliability** → Maintain a TDD loop with Jest, starting from unit/component smoke tests and expanding to contract, property, and latency suites as functionality becomes available (see T065–T066 property harness). Track latency via smoke scripts until the dedicated harness arrives.
- **Security & Secrets Protection** → Secrets isolated in Expo SecureStore (client) and environment vaults (backend). All network calls over TLS, request validation hardened against injection, CI secrets scan enabled, no secrets in logs.
- **Performance & Low-Latency Reliability** → Price recompute loop uses debounced 1 s scheduler and local cache; Fastify + WebSocket transport sized for <250 ms median response; reconnect backoff 1s→2s→5s implemented with telemetry.
- **Day-Trader UX Consistency** → Single-screen layout with stable panels, locale-aware formatting, contrast-checked palette, and inline stale-data badges so users keep context during live updates.
- **Status** → No constitution violations identified at planning time; complexity table remains empty. Will re-validate after Phase 1 artifacts land.

*Post-Design Review (2025-09-25): Phase 1 artifacts audited against the constitution; PASS maintained with no deviations.*

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
mobile/
├── app/
├── components/
└── lib/

api/
└── [same as backend above]

tests/
└── contract/

*Note*: Unit/component tests live beside their owning modules; `tests/` holds cross-cutting suites only.
```

**Structure Decision**: Option 3 – Expo app rooted at `apps/mobile/` paired with the Fastify service at `apps/api/` (mobile + API split), scaffolded during Phase 2 tasks

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:
   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

**Planned Research Topics**:
- Confirm Apex Omni OpenAPI SDK support for streaming price data, account equity retrieval, and authenticated signatures in a Node.js 22 runtime.
- Determine tick buffering + ATR(13) calculation strategy that meets the 1 s recompute cadence while keeping calculations deterministic and reproducible.
- Validate Supabase PostgreSQL configuration (managed vs. self-hosted) and on-device storage trade-offs for 30-day trade history with audit trails and offline support; decide on Redis involvement for tick buffers.
- Identify Expo-compatible strategies for secure credential storage, stale-data indicators, and background price refresh patterns without draining battery.
- Outline telemetry stack (structured logs, metrics) that satisfies constitution performance and reliability gates within managed Expo + Node deployment.

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Stage contract test harnesses** from contracts:
   - Store shared suites under `tests/contract/**`; keep unit-level specs colocated with modules
   - Author concrete failing contract tests per endpoint. If a scenario must remain pending, mark it with `test.skip` including an accountable owner and target date, then track remediation in project docs. Remove all bare `it.todo` placeholders.
   - Include shared helpers to load OpenAPI schemas without requiring live services
   - Reminder: Align with constitution Test-First and Code Quality principles—no ownerless TODO markers are permitted.
   - Mark upgrade tasks to convert todos into executing tests once endpoints exist

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/bash/update-agent-context.sh codex`
     **IMPORTANT**: Execute it exactly as specified above. Do not add or remove any arguments.
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/*, stubbed contract test harnesses, quickstart.md, agent-specific file

**Phase 1 Design Focus Areas**:
- Define shared TypeScript domain models (TradeInput, MarketSnapshot DTOs, TradeOutput, UserSettings) with validation boundaries.
- Specify API surface (REST + WebSocket) for live ticks, trade calculation requests, account equity sync, and history retrieval; map each to contracts with staged test plans.
- Produce state diagrams for risk calculator pipeline (input validation → ATR sampling → position sizing → rounding) including property-based invariants, and for data freshness handling (live → stale → reconnect).
- Outline risk visualization composition (accessibility, locale-aware formatting, stable layout), navigation entry for user settings management, and offline cache sync boundaries.
- Document mobile performance instrumentation approach (Expo profiling or Hermes sampling) to validate 55 FPS budget.
- Outline React Native view composition (Inputs panel, Outputs panel, Visualization, History) including accessibility and real-time update rules.
- Document the phased CI/test plan: unit/component smoke now, contract/property/latency suites queued post-MVP.

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Each contract → contract test task [P]
- Each entity → model creation task [P] 
- Each user story → integration test task
- Implementation tasks to make tests pass

**Ordering Strategy**:
- TDD order: Tests before implementation 
- Dependency order: Models before services before UI
- Mark [P] for parallel execution (independent files)

**Estimated Output**: 25-30 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *(none)* | — | — |


## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [x] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none required)

---
*Based on Constitution - See `.specify/memory/constitution.md`*
