# Apex Tradebill – Dev Setup

## Quick Start
- Install deps: `npm install` (or `pnpm install`)
- Run web (with proxy): `npm run web`
- Run iOS: `npm run ios`
- Run Android: `npm run android`

## Web Dev Proxy (CORS-free)
- Expo web uses Metro by default in SDK 54. Use the included local proxy to avoid CORS during web dev.
  - Start proxy: `npm run dev:proxy` (listens on `http://localhost:3001`)
  - The app auto-targets `http://localhost:3001/api` in Metro web dev. You can override via `.env APEX_BASE_URL`.

## Environment Variables
- Managed via `react-native-dotenv` and `src/config/appEnv.ts`.
- On web in development, the app defaults `APEX_BASE_URL` to `/api` automatically, so you may omit it.
- For production (web or native), set `APEX_BASE_URL` to the full API origin (no trailing slash), e.g. `https://testnet.omni.apex.exchange/api`.

Create a `.env` file based on `.env.example`:

```
# For web dev with Metro, you can also point explicitly to the local dev proxy
# APEX_BASE_URL=http://localhost:3001/api

# For native or production, use the real API
# APEX_BASE_URL=https://testnet.omni.apex.exchange/api

APEX_NETWORK=TESTNET
APEX_API_KEY=
APEX_API_SECRET=
APEX_API_PASSPHRASE=
APEX_L2_KEY=
DEFAULT_SYMBOL=BTCUSDT
DEFAULT_SYMBOL_DASH=BTC-USDT
```

## Behavior Summary
- Web + development (Metro): base URL → `http://localhost:3001/api` (local proxy), unless overridden by `.env`.
- Native (iOS/Android): base URL → `.env APEX_BASE_URL` or default `https://testnet.omni.apex.exchange/api`.
- Production builds: base URL → `.env APEX_BASE_URL` or default `https://testnet.omni.apex.exchange/api`.

## Troubleshooting
- CORS error in web dev:
  - If using Webpack web: ensure requests go to `/api/...` (the app chooses this automatically)
  - If using Metro web: the app will call the real API origin; ensure your environment allows cross-origin requests (testnet does).
- CORS in production web: you must point `APEX_BASE_URL` to the real API and serve through your own reverse proxy/CDN that permits your origin, or request CORS changes from the API provider.
- Stale settings: try `expo start -c` to clear cache.

## Relevant Files
- Dev proxy: `dev-proxy.js`
- Env resolution: `src/config/appEnv.ts`
- HTTP client: `src/lib/http.ts`
