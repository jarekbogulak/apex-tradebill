# Apex TradeBill API – Omni Secrets Feature

## Unreleased
- Added Google Secret Manager-backed Omni secret orchestration (cache, service, CLI, Fastify routes).
- Introduced Prometheus metrics + alert hooks for secret retrievals and rotation deadlines.
- Documented cache refresh, break-glass, and quickstart verification procedures.
- Ran `pnpm lint` and `pnpm --filter @apex-tradebill/api test` to keep Security/Test-First Constitution guarantees enforced for the Omni stack.
