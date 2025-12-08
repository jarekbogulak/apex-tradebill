# Data Model – Centralize Apex Omni Secrets in Google Secret Manager

**Input Spec**: /Users/booke/dev/nix-expo-ic/apex-tradebill/specs/002-the-api-app/spec.md

## Entities

### OmniSecretMetadata
Represents one production Apex Omni credential tracked by the API service.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary key |
| `secret_type` | ENUM(`trading_api_key`, `trading_client_secret`, `trading_api_passphrase`, `webhook_shared_secret`) | Unique together with `environment` |
| `environment` | ENUM(`production`) | GSM usage limited to production |
| `gcp_secret_id` | STRING | Full resource name `projects/.../secrets/...` |
| `gcp_version_alias` | STRING | Typically `latest`, but persisted to support pinning during rotations |
| `status` | ENUM(`active`, `rotating`, `deprecated`) | Drives runtime behavior |
| `rotation_due_at` | TIMESTAMP | 12-month rotation policy deadline |
| `last_rotated_at` | TIMESTAMP | For audits |
| `last_validated_at` | TIMESTAMP | Set after successful live validation |
| `owner` | STRING | Team/person accountable |
| `break_glass_enabled_until` | TIMESTAMP NULL | Non-null only during temporary overrides |

**Relationships / Rules**
- Exactly one metadata row per secret type (predefined catalog) in production.
- `status='rotating'` requires `gcp_version_alias` referencing the new version ID for staged validation.
- When `break_glass_enabled_until` is set, cache must prefer manual secret until timestamp passes.

### OmniSecretAccessEvent
Audit log of every secret read/write attempt or cache action.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | BIGSERIAL | Primary key |
| `secret_type` | ENUM (same as metadata) | Index for reports |
| `action` | ENUM(`read`, `cache_refresh`, `break_glass_apply`, `break_glass_clear`, `write_metadata`) | |
| `actor_type` | ENUM(`service`, `operator_cli`, `automation`) | |
| `actor_id` | STRING | Service account email or CLI user ID |
| `result` | ENUM(`success`, `failure`) | |
| `error_code` | STRING NULL | Populated on failures |
| `gcp_secret_version` | STRING NULL | Reported when available |
| `duration_ms` | INTEGER | Round-trip time for GSM request |
| `recorded_at` | TIMESTAMP | Default now() |

**Relationships / Rules**
- Foreign key to `OmniSecretMetadata(secret_type)` for referential integrity.
- Used by monitoring queries to detect unusual access volume.

### OmniSecretCacheState (virtual)
Ephemeral data held in memory (optionally exposed for diagnostics).

| Field | Type | Notes |
| --- | --- | --- |
| `secret_type` | ENUM | |
| `secret_version` | STRING | Last fetched GSM version |
| `fetched_at` | TIMESTAMP | When cache loaded |
| `expires_at` | TIMESTAMP | `fetched_at + 5 minutes` |
| `source` | ENUM(`gsm`, `break_glass`) | |

## State Transitions

1. **Rotation Flow**
   - Metadata `status` transitions from `active` → `rotating` when operator is testing a new version.
   - After validation succeeds and secret version is promoted, `status` returns to `active`, `last_rotated_at` updated, `rotation_due_at` pushed +12 months.

2. **Break Glass Flow**
   - When CLI uploads emergency secret, `break_glass_enabled_until` set and cache state switches `source=break_glass`.
   - Once GSM recovers or TTL expires, field resets to NULL and cache rehydrates from GSM.

3. **Cache Refresh Flow**
   - Cache entries automatically expire after 5 minutes or when `/internal/.../cache/refresh` endpoint is hit.
   - Every refresh logs an `OmniSecretAccessEvent` with `action='cache_refresh'`.

## Data Volume & Scale Assumptions
- Secret catalog limited to 4 entries; metadata table holds ≤10 rows.
- Access events expected at <10 per minute; table will retain 90 days of history before archival.
- Audit queries can run synchronously without partitioning due to low volume.
