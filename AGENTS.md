# apex-tradebill Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-09-25

## Active Technologies
- TypeScript 5.9 + Expo SDK 54 (React Native 0.81) client + Node.js 22 LTS service layer + Expo 54 managed workflow, Expo Router 3, TanStack Query 5, Zustand 5, Apex Omni OpenAPI Node SDK, Fastify 5 + `ws` 8 streaming (001-develop-apex-tradebill)
- PostgreSQL 16 for user profiles/trade history + in-process ring buffer for market ticks (Redis upgrade deferred) (001-develop-apex-tradebill)

## Project Structure
```
src/
tests/
```

## Commands
npm test [ONLY COMMANDS FOR ACTIVE TECHNOLOGIES][ONLY COMMANDS FOR ACTIVE TECHNOLOGIES] npm run lint

## Code Style
TypeScript 5.9 + Expo SDK 54 (React Native 0.81) + Node.js 22 LTS service layer: Follow standard conventions

## Recent Changes
- 001-develop-apex-tradebill: Updated stack to TypeScript 5.9, Expo SDK 54 (React Native 0.81), Node.js 22 LTS, Expo Router 3, TanStack Query 5, Zustand 5, Fastify 5 + `ws` 8

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
