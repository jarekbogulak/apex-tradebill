# Omni Secrets Runbooks

## Cache Refresh
1. Authenticate as a service identity with the `svc.omni.secrets.cache` scope.
2. Trigger a refresh of the entire cache:
   ```bash
   curl -X POST -H "Authorization: Bearer $SERVICE_TOKEN" \
        https://api.apex-tradebill.com/internal/apex-omni/secrets/cache/refresh
   ```
3. To target a single secret type:
   ```bash
   curl -X POST -H "Authorization: Bearer $SERVICE_TOKEN" \
        -H "Content-Type: application/json" \
        https://api.apex-tradebill.com/internal/apex-omni/secrets/cache/refresh \
        -d '{"secretType":"webhook_shared_secret"}'
   ```
4. Monitor `omni_secret_reads_total` and `omni_secret_failures_total` via `GET /metrics` to confirm GSM reads succeed. Consecutive failures emit `omni.alert.cache_failure` log events and should page the on-call engineer.

## Break-Glass Workflow
1. Generate an encrypted payload with the production public key and run the CLI from repo root:
   ```bash
   pnpm --filter @apex-tradebill/api breakglass:omni \
     --secretType trading_api_key \
     --ciphertext-file ./tmp/secret.enc \
     --ttl 25m \
     --api-url https://api.apex-tradebill.com \
     --token $OPS_JWT
   ```
2. Verify `/ops/apex-omni/secrets/status` reports `cacheSource="break_glass"` until the TTL expires.
3. Restore GSM access ASAP, then re-run the cache refresh endpoint to return to steady state. All break-glass events log `omni.alert.break_glass_applied` for audit purposes.

## Rotation Monitor Alerts
- The job defined in `apps/api/src/jobs/omniRotationMonitor.ts` checks every 15 minutes for overdue `rotation_due_at` values.
- When a secret exceeds its rotation window, `omni.rotation_overdue` warnings appear in the logs. Wire these to Grafana/PagerDuty to escalate if the alert persists beyond one check.

## Metrics Reference
- `GET /metrics` (text/plain Prometheus format) includes:
  - `omni_secret_reads_total{secret_type,source}` – secret retrievals per type/source.
  - `omni_secret_failures_total{secret_type,reason}` – failed GSM/override attempts.
  - `omni_secret_cache_age_seconds{secret_type,source}` – current age of cached values.
- Use these to confirm cache TTL compliance and rapid detection of stale secrets.
