# Quickstart – Apex Omni Secrets via Google Secret Manager

1. **Provision credentials**
   - Create/assign the `projects/${PROJECT_ID}/secrets/apex-omni-*` entries with IAM roles: `roles/secretmanager.secretAccessor` for the API service account and `roles/secretmanager.admin` for the operator group.
   - Export `GOOGLE_APPLICATION_CREDENTIALS` or configure Workload Identity on the deployment target.

2. **Bootstrap metadata**
   ```bash
   cd /Users/booke/dev/nix-expo-ic/apex-tradebill/apps/api
   pnpm db:check
   pnpm db:seed:omni-secrets   # new seed inserts OmniSecretMetadata rows
   ```

3. **Run the API locally**
   ```bash
   pnpm dev
   ```
   - Verify startup logs include `OmniSecretCache hydrated` with <1s duration per secret.

4. **Validate operator workflow**
   ```bash
   curl -H "Authorization: Bearer <ops-token>" \
        https://localhost:3333/ops/apex-omni/secrets/status
   ```
   - Expect 200 with metadata for `trading_api_key`, `trading_client_secret`, `webhook_shared_secret` and cache age <300 seconds.

5. **Test rotation preview**
   ```bash
   curl -X POST -H "Authorization: Bearer <ops-token>" \
        -H "Content-Type: application/json" \
        https://localhost:3333/ops/apex-omni/secrets/rotation-preview \
        -d '{"secretType":"trading_api_key","gcpSecretVersion":"5"}'
   ```
   - Expect 200 with `validated=true` before promoting version `5` in GSM.

6. **Force cache refresh + failure alert**
   ```bash
   curl -X POST -H "Authorization: Bearer <svc-token>" \
        https://localhost:3333/internal/apex-omni/secrets/cache/refresh
   ```
   - Kill GSM credentials temporarily and observe alert: `omni_secret_failures_total` increments, Omni routes return `503` while rest of API stays up.

7. **Exercise break-glass workflow**
   ```bash
   pnpm api breakglass:omni --secretType trading_api_key --ciphertext ./tmp/secret.enc --ttl 25m
   ```
   - Confirm `/ops/apex-omni/secrets/status` shows `cacheSource="break_glass"` until TTL expires or operator clears it via API.
