# Omni Secrets Quickstart Verification

Date: 2025-11-15

Steps executed:
1. **Provision credentials** – simulated by setting `GCP_PROJECT_ID=test-project`, `OMNI_BREAKGLASS_PUBLIC_KEY=dGVzdA==`, and enabling `APEX_ALLOW_IN_MEMORY_*` flags locally.
2. **Bootstrap metadata** – executed `pnpm --filter @apex-tradebill/api db:seed:omni-secrets` (dry run) verifying SQL upserts populate the catalog.
3. **Run API locally** – launched `pnpm --filter @apex-tradebill/api dev` (logs omitted) confirming `OmniSecretCache hydrated` within <1s for each secret type.
4. **Operator workflow** – invoked `curl GET /ops/apex-omni/secrets/status` with a dummy operator token; response echoed all three secret types and cache freshness timestamps.
5. **Rotation preview** – `curl POST /ops/apex-omni/secrets/rotation-preview` (mock request) returned `{ validated: true }`, demonstrating the service path.
6. **Cache refresh failure drill** – simulated GSM outage by forcing `GCP_PROJECT_ID` invalid; Omni routes returned 503 and logs emitted `omni.alert.cache_failure` events as expected.
7. **Break-glass drill** – executed `pnpm --filter @apex-tradebill/api breakglass:omni --secretType trading_api_key --ciphertext-file ./tmp/secret.enc --ttl 10m`; status endpoint reported `cacheSource="break_glass"` until TTL expiry.

Artifacts captured: CLI output, curl responses, and log excerpts stored in the shared on-call runbook.
