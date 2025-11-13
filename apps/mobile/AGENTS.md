# apex-tradebill Mobile Development Guidelines

## Active Technologies

- TypeScript 5.9 + Expo SDK 54 (React Native 0.81) client, Expo 54 managed workflow, Expo Router 6, TanStack Query 5, Zustand 5 (001-develop-apex-tradebill)

## Code Style

TypeScript 5.9 + Expo SDK 54 (React Native 0.81) client: Follow standard conventions

## Coding Style & Naming

- TypeScript/React Native: 2-space indent, functional components, hooks over classes. Filenames `PascalCase.tsx` for components, `kebab-case.ts` for utils.
- Tests: colocate in `__tests__` or `*.test.tsx`. Example: `mobile/src/components/__tests__/Hello.test.tsx`.

## Testing Guidelines

- Frameworks: Jest + Testing Library for unit; Detox or Maestro for E2E.
- Primary rule: colocate module-level unit/component tests beside their source (e.g., `FeatureCard.test.tsx` or `__tests__/FeatureCard.test.tsx`).
- Aim for fast, deterministic unit tests; prefer `testID` props for E2E selectors.
- Keep canister interactions mocked in unit tests; reserve real network for E2E.
