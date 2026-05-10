FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.19.0 --activate

FROM base AS builder
WORKDIR /app

# Copy ALL workspace manifests so pnpm can resolve the full dependency graph
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages/types/package.json             ./packages/types/
COPY packages/db/package.json                ./packages/db/
COPY packages/cache/package.json             ./packages/cache/
COPY packages/sdk/package.json               ./packages/sdk/
COPY packages/messaging/package.json         ./packages/messaging/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/eslint-config/package.json     ./packages/eslint-config/
COPY packages/tailwind-config/package.json   ./packages/tailwind-config/
COPY packages/ui/package.json                ./packages/ui/
COPY apps/api/package.json                   ./apps/api/

# Install all workspace dependencies (symlinks + hoisting work correctly)
RUN pnpm install --frozen-lockfile

# Copy source for packages the API depends on
COPY packages/types/             ./packages/types/
COPY packages/db/                ./packages/db/
COPY packages/cache/             ./packages/cache/
COPY packages/sdk/               ./packages/sdk/
COPY packages/messaging/         ./packages/messaging/
COPY packages/typescript-config/ ./packages/typescript-config/
COPY apps/api/                   ./apps/api/
COPY tsconfig.base.json          ./

# Build workspace deps in dependency order, then the API
RUN pnpm --filter @repo/types build
RUN pnpm --filter @repo/db build
RUN pnpm --filter @repo/cache build
RUN pnpm --filter @repo/sdk build
RUN pnpm --filter @repo/messaging build
RUN pnpm --filter api build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Runtime: root node_modules (contains .pnpm store + workspace symlinks)
COPY --from=builder /app/node_modules ./node_modules

# Workspace package dists + manifests needed at runtime
COPY --from=builder /app/packages/types/dist        ./packages/types/dist
COPY --from=builder /app/packages/types/package.json ./packages/types/package.json
COPY --from=builder /app/packages/db/dist            ./packages/db/dist
COPY --from=builder /app/packages/db/package.json    ./packages/db/package.json
COPY --from=builder /app/packages/cache/dist         ./packages/cache/dist
COPY --from=builder /app/packages/cache/package.json ./packages/cache/package.json
COPY --from=builder /app/packages/sdk/dist           ./packages/sdk/dist
COPY --from=builder /app/packages/sdk/package.json   ./packages/sdk/package.json
COPY --from=builder /app/packages/messaging/dist     ./packages/messaging/dist
COPY --from=builder /app/packages/messaging/package.json ./packages/messaging/package.json

# API itself
COPY --from=builder /app/apps/api/dist        ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json

EXPOSE 4000
CMD ["node", "apps/api/dist/index.js"]
