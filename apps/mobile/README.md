# Apex TradeBill Mobile

Managed Expo 54 client for the TradeBill stack. The bundle boots through `expo-router/entry` and is structured entirely with Expo Router 6 so that screens, layouts, and deep links stay colocated. Data fetching and state management lean on TanStack Query 5 and Zustand 5, with shared theme tokens sourced from `@apex-tradebill/ui`.

## Prerequisites

- Node.js 22 (managed via Corepack)
- pnpm 9 (`corepack enable pnpm`)
- Xcode / Android Studio when running native simulators

Install workspace dependencies from the repository root:

```bash
corepack pnpm install
```

## Environment Configuration

Expo injects any `EXPO_PUBLIC_*` variables from your `.env*` files into the client bundle. Copy the template and adjust values for your profile:

```bash
cp apps/mobile/.env.example apps/mobile/.env.development
```

Key variables (all public):

- `EXPO_PUBLIC_APP_ENV` – `development` | `preview` | `production`; used for display/analytics only.
- `EXPO_PUBLIC_API_TARGET` – `local` (default) or `prod`. Picks the API preset (local dev vs. Cloud Run prod). You can still override with `EXPO_PUBLIC_API_URL`.
- `EXPO_PUBLIC_API_PROD_URL` – optional override for the production API; defaults to the Cloud Run endpoint.
- `EXPO_PUBLIC_API_URL` – base URL for the TradeBill API (defaults to `http://127.0.0.1:4000`); used as override for any target.
- `EXPO_PUBLIC_API_WS_URL` – optional override for WebSocket connections; falls back to `EXPO_PUBLIC_API_URL`.
- `EXPO_PUBLIC_APEX_ENVIRONMENT` – `prod` (default) or `testnet`; chooses which public ApeX endpoints to use.
- `EXPO_PUBLIC_APEX_*` – optional overrides for REST/WebSocket endpoints. Defaults point to the standard prod/testnet clusters. Do not place private ApeX credentials or any non-public secrets here.

The resolved config is exposed at runtime via `extra` in `app.config.ts` (see `extra.api` and `extra.apexOmni`).

## Running the App

From the repo root:

```bash
pnpm dev:mobile
```

Useful variants:

- `pnpm --filter @apex-tradebill/mobile start --clear` – clear Metro cache.
- `pnpm --filter @apex-tradebill/mobile start --android` / `--ios` / `--web` – boot directly into a platform target.

## Styling & Theme

- Shared tokens live in `packages/ui/src/theme`; the provider is wired up in `app/_layout.tsx` and mirrors Expo color scheme automatically.
- Import `useTheme` from `@apex-tradebill/ui` to reach `colors`, `spacing`, `radii`, and `shadows`. Compose component styles inside `useMemo` so that dark mode updates propagate without recalculating on every render.
- Prefer `useThemeColor` (see `hooks/use-theme-color.ts`) when adapting existing `ThemedView`/`ThemedText` primitives; pass semantic tokens such as `text`, `background`, or any exported `ThemeColorToken`.
- Avoid hard-coded hex values in app code. If a new semantic color is required, extend the tokens in the UI package so both mobile and future surfaces stay in sync.

## Build Profiles and EAS

- `EAS_BUILD_PROFILE`, `EXPO_RELEASE_CHANNEL`, and `EXPO_PUBLIC_APP_ENV` are surfaced through `extra.eas` for runtime introspection.
- Add secure values (API tokens, Sentry DSNs, etc.) through EAS Secrets or your CI environment. Only `EXPO_PUBLIC_*` keys end up in the JavaScript bundle.

## Testing

```bash
pnpm --filter @apex-tradebill/mobile test
```

Jest loads a lightweight `expo-constants` mock with deterministic `env` values for fast unit tests.
