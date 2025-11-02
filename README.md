# Apex TradeBill

Apex TradeBill is a mobile-first trading companion for Apex Omni DEX day traders. It delivers fast, reliable risk and position sizing calculations backed by real-time market data, letting traders evaluate opportunities without leaving their phone. The project is organized as a pnpm-powered monorepo containing an Expo client and a Fastify service layer that share a common TypeScript type system.

## Monorepo Layout

```
apps/
  api/        Fastify + WebSocket Node.js service
  mobile/     Expo-managed React Native client
packages/
  ui/         Shared React Native UI primitives and theme tokens
  utils/      Isomorphic utilities
  types/      Shared DTOs, schemas, and API contracts
configs/      Tooling configuration (ESLint, migrations, etc.)
tests/        Cross-cutting suites (contract, latency, etc.)
```

## Tech Stack

- Node.js 22 LTS + TypeScript 5.9 across all workspaces
- Expo SDK 54, React Native 0.81, Expo Router 6, TanStack Query 5, Zustand 5 on mobile
- Fastify 5 with `ws` 8 streaming and Apex Omni OpenAPI Node SDK on the API
- PostgreSQL 16 (Supabase-compatible) for profiles, history, and configuration
- pnpm 9 workspaces with shared linting, testing, and type checking

## Prerequisites

- Node.js 22 (enable with `corepack use 22`)
- pnpm 9 (`corepack enable pnpm`)
- Xcode and/or Android Studio for native simulators
- Access to Apex Omni API credentials for production or testnet usage

## Installation & Workspace Scripts

Install dependencies from the repo root:

```bash
corepack pnpm install
```

Start the API locally:

```bash
pnpm --filter @apex-tradebill/api dev
```

Start the mobile client (web, iOS, or Android depending on your Expo target):

```bash
pnpm dev:mobile
```

Run type checks, linting, and tests across the repo:

```bash
pnpm typecheck
pnpm lint
pnpm test
```

Apply pending database migrations:

```bash
pnpm --filter @apex-tradebill/api migrate
```

## Environment Configuration

- Copy `apps/api/.env.example` to `apps/api/.env` and supply database, JWT, and Apex Omni credentials.
- Copy `apps/mobile/.env.example` to the appropriate `.env.<environment>` file (e.g., `.env.development`). The Expo app reads environment-specific values through `app.config.ts`.
- Both workspaces respect `EXPO_PUBLIC_*` and `APEX_OMNI_*` variables documented in their respective README files.

## Documentation & References

- Workspace-specific details: `apps/api/README.md`, `apps/mobile/README.md`, `configs/db/migrations/README.md`
- Engineering conventions and active technologies: `AGENTS.md`
- Apex Omni API documentation: https://api-docs.pro.apex.exchange/
