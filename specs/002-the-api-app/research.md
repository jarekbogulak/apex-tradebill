# Research – Centralize Apex Omni Secrets in Google Secret Manager

**Input Spec**: /Users/booke/dev/nix-expo-ic/apex-tradebill/specs/002-the-api-app/spec.md  
**Date**: 2025-11-15

## Decision 1: Google Secret Manager Integration Strategy
- **Decision**: Use the official `@google-cloud/secret-manager` v1 client with Workload Identity Federation so the Fastify API retrieves `projects/{project}/secrets/apex-omni-{secretType}/versions/latest` via short-lived tokens and enforces IAM roles per secret.
- **Rationale**: First-party library keeps auth handling, retries, and permission enforcement consistent with Google guidance, reduces custom crypto, and exposes audit trails needed for FR-005.
- **Alternatives Considered**:
  - REST calls via `googleapis`: more boilerplate, manually handling retries and auth token refresh.
  - Storing Omni secrets in Postgres: violates FR-001 by duplicating secrets outside GSM and introduces rotational lag.

## Decision 2: Secret Hydration & Caching Model
- **Decision**: Build an `OmniSecretCache` module that fetches all required secret versions during startup, caches decrypted values in-memory for 5 minutes, and refreshes proactively whenever operators hit a `/internal/apex-omni/secrets/cache/refresh` endpoint or when cache TTL expires.
- **Rationale**: API traffic stays within the p95 ≤1s budget by avoiding a GSM call on every Omni request, while the short TTL plus manual refresh lets infrequent rotations (<1/year) propagate quickly.
- **Alternatives Considered**:
  - Fetch secrets from GSM on each usage: would violate the 1s p95 goal whenever Google latency spikes.
  - Cache indefinitely until restart: would ignore FR-012 and delay rotation propagation beyond acceptable windows.

## Decision 3: Observability & Alerting
- **Decision**: Emit structured JSON logs via the existing Fastify/Pino logger for every secret read/write, and expose Prometheus counters (`omni_secret_reads_total`, `omni_secret_failures_total`) plus a gauge for cache freshness; wire Grafana alerts to detect consecutive failures or cache age >5 minutes.
- **Rationale**: Meets FR-005/FR-006 plus Constitution observability requirements using tooling already deployed with the API service.
- **Alternatives Considered**:
  - Ship logs only to Cloud Logging without metrics: harder to build fast alerts or SLO burn analysis.
  - Push custom notifications via email scripts: duplicative compared to existing monitoring stack.

## Decision 4: Break-Glass Workflow
- **Decision**: Provide a CLI (`pnpm api breakglass:omni`) that uploads an encrypted payload to the `/ops/apex-omni/secrets/break-glass` endpoint, where the API stores the ciphertext + TTL in Postgres and marks the cache source as `break_glass` until either GSM recovers or the TTL (≤30 minutes) expires automatically.
- **Rationale**: Keeps the entire workflow auditable through the API and database, satisfies FR-009's 30-minute requirement, and avoids managing ad-hoc local files or environment-variable overrides.
- **Alternatives Considered**:
  - Allow ad-hoc environment variables: high leakage risk and complicates auditing.
  - Keep serving stale cache indefinitely: could violate compliance if the cached secret becomes revoked.
