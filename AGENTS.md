# apex-tradebill Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-09-25

## Active Technologies

- TypeScript 5.9 + Expo SDK 54 (React Native 0.81) client + Node.js 22 LTS service layer + Expo 54 managed workflow, Expo Router 6, TanStack Query 5, Zustand 5, Apex Omni OpenAPI Node SDK, Fastify 5 + `ws` 8 streaming (001-develop-apex-tradebill)
- PostgreSQL 16 for user profiles/trade history + in-process ring buffer for market ticks (Redis upgrade deferred) (001-develop-apex-tradebill)

## Code Style

TypeScript 5.9 + Expo SDK 54 (React Native 0.81) + Node.js 22 LTS service layer: Follow standard conventions

## Recent Changes

- 001-develop-apex-tradebill: Updated stack to TypeScript 5.9, Expo SDK 54 (React Native 0.81), Node.js 22 LTS, Expo Router 6, TanStack Query 5, Zustand 5, Fastify 5 + `ws` 8

<!-- MANUAL ADDITIONS START -->

# apex-tradebill Development Guidelines - Additions

## Coding Style & Naming

- TypeScript/React Native: 2-space indent, functional components, hooks over classes. Filenames `PascalCase.tsx` for components, `kebab-case.ts` for utils.
- Tests: colocate in `__tests__` or `*.test.tsx`. Example: `mobile/src/components/__tests__/Hello.test.tsx`.
- Node.js: idiomatic TypeScript. Public APIs must be documented briefly.
- Imports: absolute within app where configured; otherwise relative, grouped (external → internal).

## Testing Guidelines

- Frameworks: Jest + Testing Library for unit; Detox or Maestro for E2E.
- Primary rule: colocate module-level unit/component tests beside their source (e.g., `FeatureCard.test.tsx` or `__tests__/FeatureCard.test.tsx`).
- Allow shared cross-cutting suites (contract, latency, end-to-end) in dedicated roots (`api/tests/**`, `tests/contract/**`) when they span packages.
- Aim for fast, deterministic unit tests; prefer `testID` props for E2E selectors.
- Keep canister interactions mocked in unit tests; reserve real network for E2E.

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

## Node.js backend in the same repo

Keep the server independent and twelve-factor:

- **apps/api** with its own `package.json`, `.env` loading, and a single start script.
- Share **types** and **validation schemas** from `/packages/types` so client and server agree (great for request/response contracts).
- If you’ll ever SSR/edge anything later, you can add `/apps/web` alongside.

## Shared packages guidance

- **/packages/ui**: React Native components only (no Node-only APIs). Avoid importing `expo` modules here unless you truly want the UI package to be Expo-aware.
- **/packages/utils**: Keep it isomorphic (no `fs`, `path`, etc.).
- **/packages/types**: Just `.d.ts` or `.ts` exports consumed by both app and server.

## API Documentation

Find the Apex Omni API documentation at https://api-docs.pro.apex.exchange/. You can use the mcp_servers.brightData endpoint to access it.

<!-- MANUAL ADDITIONS END -->
