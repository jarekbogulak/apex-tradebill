# Phase 0 Research – Apex TradeBill

## 1. Apex Omni SDK Integration
- **Decision**: Use the official `@apex-omni/openapi-node-sdk` within the Node.js 22 Fastify service for both REST and WebSocket access. REST endpoints fetch account equity snapshots and symbol metadata, while authenticated WebSocket channels stream live trades/quotes for subscribed markets.
- **Rationale**: The SDK already encapsulates authentication, request signing, and venue-specific precision rules, reducing risk of drift from venue requirements. Consolidating market connectivity server-side keeps Expo clients thin and avoids exposing API secrets.
- **Alternatives Considered**:
  - *Direct REST polling from the Expo client*: rejected because it would leak credentials, duplicate signing logic on devices, and make it harder to guarantee deterministic ATR calculations.
  - *Third-party market data aggregators*: rejected because the constitution demands verified sources and we would lose venue-specific precision/latency guarantees.

## 2. Tick Buffering & ATR(13) Pipeline
- **Decision**: Start with an in-process ring buffer per symbol inside the Fastify service, seeded by the live WebSocket feed. The buffer keeps the last N ticks required for deterministic ATR(13) (Wilder’s RMA) recomputed every second and published to clients. When concurrency or horizontal scaling demands it, promote the buffer to Redis without changing calculator contracts.
- **Rationale**: An in-memory structure satisfies the one-second recompute cadence and two-second freshness requirement without introducing operational overhead in the MVP. Centralizing ATR math server-side still guarantees consistent results per trader and preserves auditability. Future promotion to Redis is a drop-in infrastructure change rather than a rewrite.
- **Alternatives Considered**:
  - *Client-side ATR computation*: rejected due to drift risks and extra mobile CPU/battery drain.
  - *Redis streams from day one*: deferred to avoid managing external infrastructure before traffic justifies it.

## 3. Persistence & Offline Strategy
- **Decision**: Supabase-backed PostgreSQL (managed or self-hosted) remains the system of record for users, settings, and trade calculation history (30-day retention enforced nightly). The Expo app caches the 20 most recent calculations locally via `expo-sqlite` for offline recall; caches sync bi-directionally when connectivity returns.
- **Rationale**: Supabase delivers standard PostgreSQL with optional self-hosting, so we gain managed operations without sacrificing portability. By limiting ourselves to ANSI SQL and avoiding Supabase-specific APIs, we preserve the auditability and deterministic replay required by the constitution while keeping an exit path to vanilla Postgres if needed.
- **Alternatives Considered**:
  - *Purely local storage*: rejected because it cannot satisfy auditability, multi-device expectations, or future analytics.
  - *Document store (e.g., MongoDB)*: rejected since relational joins (users ↔ trade history ↔ market snapshots) are straightforward and Postgres-compatible engines provide stronger transactional guarantees.

## 4. Expo Security & Data Freshness Handling
- **Decision**: Secrets (refresh tokens, account linkage) live inside Expo SecureStore; volatile session keys stay in memory only. The app maintains a one-second scheduler that consumes the backend’s live tick stream; if no event arrives within two seconds it flips the UI into “Stale,” initiates reconnect backoff (1 s → 2 s → 5 s), and prompts for manual price entry.
- **Rationale**: SecureStore is the recommended Expo mechanism for sensitive values and avoids plaintext storage. Implementing staleness detection on the client provides immediate UX feedback while the server handles reconnection and buffering.
- **Alternatives Considered**:
  - *Storing secrets in AsyncStorage*: rejected because it lacks encryption at rest.
  - *Letting the server control staleness UI*: rejected because network jitter could delay the signal; the client can react faster with its own timer.

## 5. Observability & Performance Instrumentation
- **Decision**: Begin with structured logs (Pino) that record latency buckets, error codes, and reconnect attempts, plus minimal in-process metrics exposed via `/healthz` and exercised by CI smoke tests. Introduce full OpenTelemetry and external collectors once sustained load or multi-environment deployments make it worthwhile.
- **Rationale**: The constitution requires measurable performance data, which lightweight logging and metrics can deliver without committing to an observability stack up front. The logging schema is designed so OTEL exporters can be layered on later without changing producers.
- **Alternatives Considered**:
  - *Ad-hoc console logging*: rejected because it complicates parsing latency evidence.
  - *Immediate OTEL collector deployment*: deferred until we have non-trivial traffic and multiple environments.

## 6. Test Strategy Alignment
- **Decision**: Use Jest as the unified runner, but phase adoption: start with API unit tests and component smoke tests driven by mocks, add contract validation once endpoints exist, and layer property-based and latency harnesses after baseline functionality ships.
- **Rationale**: This sequencing keeps tests green while scaffolding is created, yet preserves a roadmap to the constitution’s reliability requirements. By shaping helpers and fixtures now, we keep the door open for higher-assurance suites without blocking initial delivery.
- **Alternatives Considered**:
  - *Split runners (Jest client, Vitest server)*: rejected to contain tooling complexity.
  - *Single-stage, full test matrix immediately*: rejected because it forces implementation of every endpoint before any test can pass.

---

All planned unknowns are resolved, and later-phase enhancements are documented for when we scale beyond the MVP.
