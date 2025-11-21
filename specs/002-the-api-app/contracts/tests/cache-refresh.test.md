# Contract Test – POST /internal/apex-omni/secrets/cache/refresh

## Assertions
1. Allows optional `secretType` to target a single cache entry; defaults to all entries.
2. Responds with 202 and the actual secret types scheduled for refresh.
3. Triggers asynchronous fetches that emit `OmniSecretAccessEvent` rows with `action='cache_refresh'`.

## Current Result
- [ ] PASS
- [x] FAIL — Refresh endpoint unimplemented yet.
