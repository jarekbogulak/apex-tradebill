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

## CI / Quality Gates

- Run `pnpm install --frozen-lockfile` on Node.js 22 in CI (use `corepack` to pin).
- Gate merges with `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm security:scan`.
- Prefer workspace-local scripts (`pnpm --filter ...`) rather than ad-hoc tool invocations to avoid phantom dependency drift.

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

- Copy `apps/api/.env.example` to `apps/api/.env` and supply database, JWT, and (optional) ApeX Omni credentials for private endpoints.
- Copy `apps/mobile/.env.example` to the appropriate `.env.<environment>` file (e.g., `.env.development`). The Expo app only consumes `EXPO_PUBLIC_*` variables; never place private ApeX Omni secrets in mobile env files.
- The API continues to use `APEX_OMNI_*` for server-side credentials; the mobile app uses `EXPO_PUBLIC_APEX_*` for public endpoints only. See the app-specific READMEs for details.

## Device Activation Flow

Every device must register once to receive a JWT before the app will load trading features:

1. Issue a short-lived activation code for a specific device ID:

   ```bash
   pnpm --filter @apex-tradebill/api auth:issue-device-code --device <your-device-id>
   ```

2. Launch the mobile app, note the displayed device ID, and enter the activation code on the activation screen. Successful registration stores the token securely and all future API calls include `Authorization: Bearer …` headers.

Once the fleet is provisioned, enable Supabase row-level security with policies scoped to `trade_calculations.user_id` to keep history data private per authenticated user.

## Documentation & References

- Workspace-specific details: `apps/api/README.md`, `apps/mobile/README.md`, `configs/db/migrations/README.md`
- Engineering conventions and active technologies: `AGENTS.md`
- Apex Omni API documentation: https://api-docs.pro.apex.exchange/
