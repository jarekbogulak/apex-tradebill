# Contract Test – GET /ops/apex-omni/secrets/status

## Assertions
1. Requires operator JWT scoped with `ops.omni.secrets.read`.
2. Returns HTTP 200 with all predefined secret types and cache metadata.
3. Hides actual secret values; only metadata is present.

## Current Result
- [ ] PASS
- [x] FAIL — Endpoint not implemented; will fail once contract tests execute.
