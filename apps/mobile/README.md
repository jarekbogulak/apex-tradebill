# Apex TradeBill Mobile

Managed Expo 54 client for the TradeBill stack. We use a typed `app.config.ts` and env files to keep local, preview, and production builds in sync.

## Prerequisites

- Node.js 22 (managed via corepack)
- pnpm 9 (`corepack enable pnpm`)
- Xcode / Android Studio when running native simulators

Install workspace dependencies from the repository root:

```bash
corepack pnpm install
```

## Environment configuration

`app.config.ts` loads environment variables from the closest matching file:

1. `.env`
2. `.env.<environment>`
3. `.env.local`
4. `.env.<environment>.local`

Copy the template and adjust values for your profile:

```bash
cp apps/mobile/.env.example apps/mobile/.env.development
```

Key variables:

- `EXPO_PUBLIC_APP_ENV` – `development` | `preview` | `production`; influences which `.env.*` file is read.
- `EXPO_PUBLIC_API_URL` – base URL for the TradeBill API (defaults to `http://127.0.0.1:4000`).
- `EXPO_PUBLIC_API_WS_URL` – optional override for WebSocket connections; falls back to `EXPO_PUBLIC_API_URL`.
- `EXPO_PUBLIC_APEX_ENVIRONMENT` – `prod` (default) or `testnet`. When unset the mobile build inherits `APEX_OMNI_ENVIRONMENT` from the API env, so you can share a single toggle or override per-client when needed.
- `EXPO_PUBLIC_APEX_*` – optional overrides for REST/WebSocket endpoints. We default to the same prod/testnet URLs defined for the API service (see `apps/api/.env.example`), so only set these when you need an alternate cluster. Credentials stay server-side.

The resolved config is exposed at runtime via `env` (`src/config/env.ts`).

## Running the app

From the repo root:

```bash
pnpm dev:mobile
```

Useful variants:

- `pnpm --filter @apex-tradebill/mobile start --clear` – clear Metro cache.
- `pnpm --filter @apex-tradebill/mobile start --android` / `--ios` / `--web` – boot directly into a platform target.

## Build profiles and EAS

- `EAS_BUILD_PROFILE`, `EXPO_RELEASE_CHANNEL`, and `EXPO_PUBLIC_APP_ENV` are surfaced through `extra.eas` for runtime introspection.
- Add secure values (API tokens, Sentry DSNs, etc.) through EAS Secrets or your CI environment. Only `EXPO_PUBLIC_*` keys end up in the JavaScript bundle.

## Testing

```bash
pnpm --filter @apex-tradebill/mobile test
```

Jest loads a lightweight `expo-constants` mock with deterministic `env` values for fast unit tests.
