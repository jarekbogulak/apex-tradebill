<!--
Sync Impact Report
- Version change: N/A (template) → 1.0.0
- Modified principles: N/A (initial adoption)
- Added sections: Core Principles (7), Additional Constraints & Standards, Development Workflow & Quality Gates, Governance
- Removed sections: None
- Templates requiring updates:
  ✅ .specify/templates/plan-template.md (generic constitution reference)
  ✅ .specify/templates/tasks-template.md (security/observability/performance gates)
  ✅ .specify/templates/spec-template.md (Constitution alignment checklist)
  ⚠ .specify/templates/commands/* (not present in repo)
- Deferred TODOs: None
-->

# Apex TradeBill Constitution

## Core Principles

### Financial Data Integrity
- All market data MUST originate from verified and approved sources.  
- Calculations MUST be deterministic, reproducible, and traceable. Persist the full
  input vector (account size, direction, entry/stop/target, volatility window, multipliers)
  alongside computed outputs for auditability.
- Inputs MUST be validated (ranges, types, required fields). Reject stale data and
  clock skew; use server time when provided.
- No silent failure: errors MUST return explicit codes/messages.  
Rationale: Day traders depend on precise numbers; any drift or ambiguity directly
impacts capital at risk.

### Risk Management Discipline
- Volatility-informed stops are the default. Provide a configurable multiplier with
  sensible, documented defaults defined at the product level (outside this document).
- Per‑trade risk as a percent of equity MUST be configurable. Never exceed the
  configured cap when sizing positions.
- Enforce a minimum stop distance derived from volatility to avoid noise‑triggered
  liquidations.
- All sizing formulas MUST be documented and covered by property-based tests.
Rationale: Consistent risk controls prevent outsized loss from execution pressure.

### Code Quality and Simplicity
- Prefer small, single-responsibility modules and pure functions for calculators.
- Avoid speculative abstractions; only extract once duplication is proven.
- Public interfaces MUST be documented; internal invariants enforced with assertions.
- No dead code, no TODOs without owner and date.
Rationale: Simple, clear code reduces defect surface in a latency-sensitive domain.

### Test-First and Reliability
- TDD is mandatory: write tests → verify red → implement → refactor.
- Cover calculation paths with unit and property-based tests; cover API integrations
  with contract tests; cover end-to-end user flows for critical paths.
- Establish reliability guards in CI: tests, type checks, lint, and budget checks
  MUST pass before merge.
Rationale: Prevents regressions in math and behavior under live market conditions.

### Security and Secrets Protection (Crypto‑grade)
- Never commit secrets. Use platform secure storage and CI secret managers; rotate
  credentials regularly.
- All network traffic MUST use TLS; pin certificates where supported. Strict input
  validation and output encoding are required.
- Enable automated secrets scanning and dependency vulnerability audits in CI.
Rationale: Trading contexts demand high assurance against leakage and tampering.

### Performance and Low‑Latency Reliability
- Core interactions MUST be responsive and jank‑free.
- Define and enforce quantifiable performance budgets (e.g., latency percentiles,
  frame consistency) appropriate to target devices and networks.
- Avoid blocking critical interaction threads; batch/ debounce inbound ticks; cache
  stable inputs.
Rationale: Timely decisions require predictable latency and smooth interaction.

### Day‑Trader UX Consistency
- Default to single‑screen, one‑hand workflows with clear affordances.
- Display all critical outputs (size, cost, risk, R:R) in a stable layout with
  accessible contrast and locale‑aware numeric formatting.
- Real‑time updates MUST never rearrange controls; prefer inline deltas.
Rationale: Familiar, stable interactions reduce cognitive load under time pressure.

## Additional Constraints & Standards
- Technology choices MUST keep a single source of truth for calculation logic and
  avoid unnecessary platform lock‑in.
- Observability: Structured logs for key events; aggregate metrics for latency,
  error rates, and calculation volume. No PII. Crash/error reporting enabled.
- Precision & Time: Use decimal math for currency; sync clocks and persist server
  timestamps where provided.
- Accessibility: Meet baseline contrast and font scaling guidelines.

## Development Workflow & Quality Gates
- Constitution Check at plan time and post‑design is mandatory (see templates).
- Pre‑merge CI MUST pass: tests, lint/type checks, secrets scan, dependency audit,
  and performance/reliability budgets.
- Code review MUST verify: adherence to principles, adequate tests, and explicit
  rationale for any complexity. Deviations require an approved Complexity entry.
- Releases MUST include change notes mapping to principles affected.

## Governance
- Authority: This constitution guides technical decisions for Apex TradeBill and
  supersedes ad‑hoc practices.
- Amendments: Propose via PR with rationale, migration/rollout plan, and updated
  checklists. Approval requires consensus from two maintainers or Project Lead + 1.
- Versioning: Semantic versioning of this document
  • MAJOR: incompatible governance or principle redefinitions/removals
  • MINOR: added principle/section or materially expanded guidance
  • PATCH: clarifications and non‑semantic refinements
- Compliance Reviews: Enforced at planning and post‑design via the Constitution
  Check section in plan.md and CI gates.

**Version**: 1.0.0 | **Ratified**: 2025-09-24 | **Last Amended**: 2025-09-24
