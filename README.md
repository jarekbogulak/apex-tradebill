# Apex Tradebill – Dev Setup

## Quick Start
- Install deps: `npm install` (or `pnpm install`)
- Run web (with proxy): `npm run web`
- Run iOS: `npm run ios`
- Run Android: `npm run android`

## Web Dev Proxy (CORS-free)
- `webpack.config.js` configures Webpack Dev Server to proxy any request starting with `/api` to `https://testnet.omni.apex.exchange`, preserving the `/api` prefix.
- Example: `/api/v3/ticker?symbol=BTCUSDT` → `https://testnet.omni.apex.exchange/api/v3/ticker?symbol=BTCUSDT`.
- This only applies in development for Expo Web; native apps are unaffected.

## Environment Variables
- Managed via `react-native-dotenv` and `src/config/appEnv.ts`.
- On web in development, the app defaults `APEX_BASE_URL` to `/api` automatically, so you may omit it.
- For production (web or native), set `APEX_BASE_URL` to the full API origin (no trailing slash), e.g. `https://testnet.omni.apex.exchange/api`.

Create a `.env` file based on `.env.example`:

```
# Use `/api` in web dev (optional; defaults to `/api` on web dev if unset)
# APEX_BASE_URL=/api

# Or use the real API (e.g. native, or production web)
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
- Web + development: base URL → `/api` (proxied by Webpack dev server).
- Native (iOS/Android): base URL → `.env APEX_BASE_URL` or default `https://testnet.omni.apex.exchange/api`.
- Production builds: base URL → `.env APEX_BASE_URL` or default `https://testnet.omni.apex.exchange/api`.

## Troubleshooting
- CORS error in web dev: ensure requests go to `/api/...` (the app does this automatically via `src/config/appEnv.ts`). Use `npm run web` so the proxy runs.
- CORS in production web: you must point `APEX_BASE_URL` to the real API and serve through your own reverse proxy/CDN that permits your origin, or request CORS changes from the API provider.
- Stale settings: try `expo start -c` to clear cache.

## Relevant Files
- Webpack proxy: `webpack.config.js`
- Env resolution: `src/config/appEnv.ts`
- HTTP client: `src/lib/http.ts`
