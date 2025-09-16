# Repository Guidelines

This repository is an Expo (React Native + Web) app written in TypeScript. Follow the conventions below to keep contributions consistent and easy to review.

## Project Structure & Module Organization
- Source: `src/` (components, screens, hooks, lib, config, state, tests)
- Entry points: `index.ts`, `src/App.tsx`
- Assets: `assets/`
- Config: `app.json`, `babel.config.js`, `metro.config.js`, `webpack.config.js`, `tsconfig.json`
- Path alias: import app code via `@/…` (see `tsconfig.json`).

## Build, Test, and Development Commands
- Start (dev hub): `npm start`
- Web (with proxy): `npm run web`
- iOS simulator: `npm run ios`
- Android emulator: `npm run android`
- Tests: `npx jest` (roots: `src/tests`)

## Coding Style & Naming Conventions
- Language: TypeScript (`strict: true`)
- Indentation: 2 spaces; Quotes: single; Semicolons: required
- Filenames: React components `PascalCase.tsx`; hooks `useSomething.ts`; utility modules `camelCase.ts`
- Imports: prefer `@/` alias for app code; group external before internal
- Do not commit `.env`; update `.env.example` when adding variables

## Testing Guidelines
- Framework: Jest + ts-jest; test files `*.test.ts(x)` under `src/tests`
- Aim to cover pure logic in `src/lib` and store logic in `src/state`
- Run: `npx jest --watch` locally; keep tests deterministic and fast

## Commit & Pull Request Guidelines
- Use Conventional Commits (e.g., `feat:`, `fix:`, `chore:`). Example: `feat(trade): add order list filter`
- PRs should include:
  - Clear description, rationale, and screenshots for UI changes
  - Linked issue/Task ID, and steps to test
  - Updated docs and `.env.example` if config changes
- Keep PRs focused and small; prefer follow‑ups to large refactors

## Security & Configuration Tips
- Env management: `react-native-dotenv` + `src/config/appEnv.ts`
- Web dev uses a proxy (`webpack.config.js`) for `/api` → Apex testnet; do not hardcode API origins
- Never log or bundle secrets; use `expo-secure-store` for sensitive native storage

## Architecture Overview
- UI: `components/` (reusable), `screens/` (routes)
- Data: `lib/http.ts` (Axios clients), `lib/apexSign.ts` (signing), React Query for fetching
- State: `zustand` stores in `state/`

