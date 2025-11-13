# apex-tradebill API Development Guidelines

## Active Technologies

- TypeScript 5.9 + Node.js 22 LTS service layer, Apex Omni OpenAPI Node SDK, Fastify 5 + `ws` 8 streaming (001-develop-apex-tradebill)
- PostgreSQL 16 for user profiles/trade history + in-process ring buffer for market ticks (Redis upgrade deferred) (001-develop-apex-tradebill)

## Code Style

Node.js 22 LTS service layer: Follow standard conventions

## Coding Style & Naming

- Node.js: idiomatic TypeScript. Public APIs must be documented briefly.

## Testing Guidelines

- Allow shared cross-cutting suites (contract, latency, end-to-end) in dedicated roots (`api/tests/**`, `tests/contract/**`) when they span packages.

## Node.js backend in the same repo

Keep the server independent and twelve-factor:

- **apps/api** with its own `package.json`, `.env` loading, and a single start script.
- Share **types** and **validation schemas** from `/packages/types` so client and server agree (great for request/response contracts).
- If you’ll ever SSR/edge anything later, you can add `/apps/web` alongside.

## Hexagonal Architecture Quick Reference

- **Folders:** Keep `domain/` framework-free; put inbound adapters in `adapters/http/**`, outbound tech in `adapters/persistence/**`, streaming in `adapters/streaming/**`, jobs in `adapters/jobs/**`, etc. Platform glue (DB pools, external clients) lives under provider subfolders.
- **Domain Rules:** Only pure logic, entities, ports, and use-case factories (named `makeGetFoo`, `makeUpdateBar`). No Fastify/DB/env imports inside `domain/**`.
- **Ports & Adapters:** Ports sit in `domain/.../*.ports.ts` (nouns). Adapters implement them as `*.tech.ts` (e.g., `tradeCalculationRepository.postgres.ts`, `equityRepository.inMemory.ts`) and live inside `adapters/...`.
- **Use Cases:** Name verb phrase files `*.usecase.ts` and expose factories returning plain functions; inject all IO via ports.
- **HTTP Layer:** Each Fastify feature has its own module under `adapters/http/fastify/<context>/`. They parse/validate, call use cases, and map domain errors to HTTP responses via `shared/http.ts`.
- **Composition Root:** `config/appDeps.ts` wires adapters + use cases and `server.ts` only orchestrates Fastify and lifecycle hooks (auth, streaming, jobs, recovery).

## API Documentation

Find the Apex Omni API documentation at https://api-docs.pro.apex.exchange/. You can use the mcp_servers.brightData endpoint to access it.

