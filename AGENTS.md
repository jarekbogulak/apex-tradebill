# apex-tradebill Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-09-25

## Active Technologies
- TypeScript 5.9 targeting Node.js 22 (Fastify API workstation) + Fastify 5, `@google-cloud/secret-manager`, `apexomni-connector-node`, Pino logger, Postgres + `pg` driver (002-the-api-app)
- Google Secret Manager for secret material; Postgres for metadata/access logs (002-the-api-app)

See app-specific guides for detailed stacks:

- Mobile Expo client: `apps/mobile/AGENTS.md`
- Fastify/Node API service: `apps/api/AGENTS.md`

## Code Style

Platform-specific conventions now live in each app's `AGENTS.md`. Shared guidance that applies repo-wide remains below.

## Recent Changes
- 002-the-api-app: Added TypeScript 5.9 targeting Node.js 22 (Fastify API workstation) + Fastify 5, `@google-cloud/secret-manager`, `apexomni-connector-node`, Pino logger, Postgres + `pg` driver
- 001-develop-apex-tradebill: Updated stack to TypeScript 5.9, Expo SDK 54 (React Native 0.81), Node.js 22 LTS, Expo Router 6, TanStack Query 5, Zustand 5, Fastify 5 + `ws` 8

<!-- MANUAL ADDITIONS START -->

# apex-tradebill Development Guidelines - Additions

## Coding Style & Naming

- Imports: absolute within app where configured; otherwise relative, grouped (external → internal).
- See `apps/mobile/AGENTS.md` and `apps/api/AGENTS.md` for additional platform-specific rules.

## Monorepo Layout

Use workspaces (pnpm).

```plaintext
apps/
├── mobile    # Expo app
└── api       # Fastify/Node service layer

packages/
├── ui        # Shared React Native components (JS/TS)
├── utils     # Shared utilities (isomorphic)
└── types     # Shared TypeScript types (DTOs, API contracts)

tests/        # Cross-cutting suites (contract, latency) when not colocated
configs/      # Shared configs (ESLint, TS, Babel, etc.)
```

## Shared packages guidance

- **/packages/ui**: React Native components only (no Node-only APIs). Avoid importing `expo` modules here unless you truly want the UI package to be Expo-aware.
- **/packages/utils**: Keep it isomorphic (no `fs`, `path`, etc.).
- **/packages/types**: Just `.d.ts` or `.ts` exports consumed by both app and server.

<!-- MANUAL ADDITIONS END -->
