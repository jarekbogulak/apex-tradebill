# syntax=docker/dockerfile:1.7

FROM node:22-slim AS base
WORKDIR /app
ENV NODE_ENV=production

FROM base AS deps
RUN corepack enable pnpm && pnpm config set store-dir /pnpm/store
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/types/package.json packages/types/
COPY packages/utils/package.json packages/utils/
# Pre-fetch minimal workspace graph to install only what's needed for the API
RUN pnpm fetch --filter @apex-tradebill/api...
RUN pnpm install --recursive --filter @apex-tradebill/api... --offline

FROM deps AS build
ENV NODE_ENV=production
COPY tsconfig.base.json ./
COPY apps/api/tsconfig.json apps/api/
COPY packages/types packages/types
COPY packages/utils packages/utils
COPY apps/api/src apps/api/src
RUN pnpm --filter @apex-tradebill/api build

FROM build AS prod-deps
RUN pnpm prune --prod --filter @apex-tradebill/api...

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable pnpm && pnpm config set store-dir /pnpm/store
# Copy runtime node_modules for API only
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=prod-deps /pnpm/store /pnpm/store
COPY apps/api/package.json apps/api/
COPY --from=build /app/apps/api/dist apps/api/dist
# Non-root user for safety
USER node
CMD ["node", "apps/api/dist/server.js"]
