# apex-tradebill Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-09-25

## Active Technologies
- TypeScript 5.9 + Expo SDK 54 (React Native 0.81) client + Node.js 22 LTS service layer + Expo 54 managed workflow, Expo Router 3, TanStack Query 5, Zustand 5, Apex Omni OpenAPI Node SDK, Fastify 5 + `ws` 8 streaming (001-develop-apex-tradebill)
- PostgreSQL 16 for user profiles/trade history + in-process ring buffer for market ticks (Redis upgrade deferred) (001-develop-apex-tradebill)

## Code Style
TypeScript 5.9 + Expo SDK 54 (React Native 0.81) + Node.js 22 LTS service layer: Follow standard conventions

## Recent Changes
- 001-develop-apex-tradebill: Updated stack to TypeScript 5.9, Expo SDK 54 (React Native 0.81), Node.js 22 LTS, Expo Router 3, TanStack Query 5, Zustand 5, Fastify 5 + `ws` 8

<!-- MANUAL ADDITIONS START -->
# apex-tradebill Development Guidelines - Additions

## Coding Style & Naming
- TypeScript/React Native: 2‑space indent, functional components, hooks over classes. Filenames `PascalCase.tsx` for components, `kebab-case.ts` for utils.
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
/mobile       # Expo app
/api          # Fastify/Node service layer

/packages
├── ui        # Shared React Native components (JS/TS)
├── utils     # Shared utilities (isomorphic)
└── types     # Shared TypeScript types (DTOs, API contracts)

/tests        # Cross-cutting suites (contract, latency) when not colocated
/configs      # Shared configs (ESLint, TS, Babel, etc.)
```

## Expo + workspaces: the compatibility checklist
Make sure these are in place:

* **Single React Native/Expo SDK**  
  Hoist one copy of `react-native` and Expo packages at the repo root to avoid duplicates.

* **Metro + symlinks**  
  In `mobile/metro.config.js`, use `@expo/metro-config` and include your shared `packages` in `watchFolders`. Ensure Metro transpiles code from `packages/*` (they’re symlinked).

  *Rules of thumb:*
  - Shared packages should ship source (`.ts/.tsx/.js`) not prebuilt CJS only.
  - Add a `"react-native"` entry in shared packages’ `package.json` if you need to point Metro to source.
  - Keep Babel preset simple in the mobile app: `babel-preset-expo`.

* **Transpile shared code**  
  If code in `/packages` uses TS/modern JS, ensure it’s transpiled by the app’s Babel (not compiled per-package). Don’t rely on per-package build steps unless you must.

* **No multiple Reacts**  
  Ensure only one `react` and `react-native` resolve path. If you hit “multiple copies of React” errors, pin versions and verify the resolver is not picking duplicates.

* **Package manager settings**  
  pnpm works well with Expo now. 

* **EAS/CI builds**  
  Point builds at `mobile`. If using EAS, set the correct working directory and ensure the workspace installs at the repo root before the build step.

## Node.js backend in the same repo
Keep the server independent and twelve-factor:

* **/api** with its own `package.json`, `.env` loading, and a single start script.
* Share **types** and **validation schemas** from `/packages/types` so client and server agree (great for request/response contracts).
* If you’ll ever SSR/edge anything later, you can add `/web` alongside.

## Shared packages guidance
* **/packages/ui**: React Native components only (no Node-only APIs). Avoid importing `expo` modules here unless you truly want the UI package to be Expo-aware.
* **/packages/utils**: Keep it isomorphic (no `fs`, `path`, etc.).
* **/packages/types**: Just `.d.ts` or `.ts` exports consumed by both app and server.

## Config unification
* Root **TSConfig** extends to app and server; override per-app as needed.
* Root **ESLint/Prettier** for consistent lint/format.
* Optional **env** pattern: `/configs/env` with Zod for schema-checked env, and lightweight wrappers so the mobile app never touches server secrets.

## Scripts & dev flow
At the root:

* `dev:mobile` → runs `expo start` in `/mobile`
* `pnpm dev:api` → runs `tsx` in `/api`
* `pnpm dev` → runs both with native pnpm (`pnpm -r dev --parallel`)
* `pnpm lint`, `pnpm typecheck`, `pnpm test` → run across the repo consistently

## Routing & navigation
* Use **Expo Router** in `mobile/app/**` for file-based routes.
* Keep deep linking config in the Expo app and share route constants (strings) from `/packages/types` if handy.

## CI/CD basics
* Install at root, cache the workspace, then build/test each target (`mobile`, `api`).
* For mobile releases, use EAS; for API, your usual Node deploy (Docker, serverless, etc.).

## Common pitfalls (and how to avoid them)
* **Untranspiled code from /packages** → Ensure Metro transpiles it (watchFolders + Babel).
* **Duplicate React/React Native** → Hoist one version, check lockfile, and ensure resolver isn’t pulling a second copy via a nested dependency.
* **Native modules in shared packages** → Prefer keeping them in the Expo app; shared UI should be JS/TS where possible.
* **Env leakage** → Never import server-only code from the mobile app; keep boundaries strict.

## API Ducumentaion
Find the Apex Omni API documentation at https://api-docs.pro.apex.exchange/. You can use the mcp_servers.brightData endpoint to access it.
<!-- MANUAL ADDITIONS END -->
