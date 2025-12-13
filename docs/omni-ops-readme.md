# Apex Omni Ops & Secrets Guide

This guide covers how to operate the Omni secrets subsystem safely: required environment, roles/scopes, how to mint ops JWTs, and how to call the protected endpoints.

## 1) Prerequisites
- API deployed with:
  - `JWT_SECRET` set (GSM in prod).
  - `APEX_DEVICE_ACTIVATION_SECRET` set (GSM in prod).
  - Omni break-glass keys (`OMNI_BREAKGLASS_PUBLIC_KEY` / `OMNI_BREAKGLASS_PRIVATE_KEY`).
- Ops/service identity that can sign HS256 JWTs with `JWT_SECRET`.
- Base URL for the API (e.g., `https://api.example.com` in prod).

## 2) Required scopes/roles
Any one of the following grants access (scopes are preferred):
- Broad: `omni:manage` or `omni:ops`.
- Fine-grained:
  - Status: `ops.omni.secrets.read`
  - Rotation preview: `ops.omni.secrets.rotate`
  - Break-glass: `ops.omni.secrets.breakglass`
  - Cache refresh: `svc.omni.secrets.cache`
- Roles (alternative): `ops` or `omni-ops` in `roles` claim.

## 3) Minting an ops JWT (HS256)
Use your IdP/CI issuer if possible. For local/dev, you can mint with Node:

```js
import crypto from 'node:crypto';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret';
const iss = process.env.JWT_ISSUER ?? 'apex-tradebill';
const aud = process.env.JWT_AUDIENCE ?? 'apex-tradebill-clients';

const signHs256 = (header, payload, secret) => {
  const enc = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const body = `${enc(header)}.${enc(payload)}`;
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
};

const now = Math.floor(Date.now() / 1000);
const token = signHs256(
  { alg: 'HS256', typ: 'JWT' },
  {
    sub: 'ops-user-123',
    iss,
    aud,
    scope: 'ops.omni.secrets.read ops.omni.secrets.rotate', // set what you need
    exp: now + 5 * 60, // 5 minutes
    iat: now,
  },
  JWT_SECRET,
);

console.log(token);
```

Guidance:
- Issue short-lived tokens (5–15 minutes).
- Use separate scopes per job (e.g., cache-refresh bot gets only `svc.omni.secrets.cache`).
- If a token leaks, rotate `JWT_SECRET` in GSM and redeploy.

## 4) Calling protected endpoints
Send the token in `Authorization: Bearer <token>`.

Examples (swap base URL and payloads):
```bash
BASE_URL=https://api.example.com

# Status
curl -H "Authorization: Bearer $TOKEN" "$BASE_URL/ops/apex-omni/secrets/status"

# Rotation preview
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"secretType":"trading_api_key","gcpSecretVersion":"5"}' \
  "$BASE_URL/ops/apex-omni/secrets/rotation-preview"

# Break-glass
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"secretType":"trading_api_key","ciphertext":"<base64>","expiresAt":"2025-01-01T00:00:00Z"}' \
  "$BASE_URL/ops/apex-omni/secrets/break-glass"

# Cache refresh (all or single secret)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' \
  "$BASE_URL/internal/apex-omni/secrets/cache/refresh"
```

Expected auth failures:
- Missing/invalid token: 401.
- Token without required scope/role: 403.

## 5) Device activation secret
- Device activation HMAC uses `APEX_DEVICE_ACTIVATION_SECRET`.
- In prod, set via GSM secret `apex-tradebill-prod-DEVICE_ACTIVATION_SECRET` (see `service.yaml` and `create_secrets.sh`).

## 6) Redaction/log hygiene
- Pino redaction removes `authorization`, `cookie`, ops tokens, and Omni creds. Do not log request bodies for ops endpoints in custom handlers.

## 7) Quick checklist for prod
- [ ] GSM secrets: `JWT_SECRET`, `APEX_DEVICE_ACTIVATION_SECRET`, break-glass keys, DB URL.
- [ ] Issuer configured to sign HS256 tokens with correct `iss`/`aud`.
- [ ] Ops tokens scoped per job/user.
- [ ] Monitoring: watch `omni_secret_failures_total`/`omni_secret_reads_total` for anomalies.
