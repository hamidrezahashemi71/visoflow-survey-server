# Multi-stage build for the Viso backend (Fastify + Prisma, ESM on Node 22).
# The image boots entirely from environment variables — no secrets are baked in.

FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# corepack downloads pnpm from a registry on first use; point it at a mirror
# reachable from Iran so the build doesn't hang fetching the package manager.
ENV COREPACK_NPM_REGISTRY="https://registry.npmmirror.com"
RUN corepack enable
WORKDIR /app

# --- Build: install all deps, generate the Prisma client, bundle with tsup ---
FROM base AS build
# Prisma's query engine is downloaded from binaries.prisma.sh during
# `prisma generate` (postinstall) — that host is often unreachable from Iran,
# so pull the engine from a mirror instead.
ENV PRISMA_ENGINES_MIRROR="https://registry.npmmirror.com/-/binary/prisma"
# Copy the whole build context in one shot (node_modules, dist, .git, .env are
# excluded via .dockerignore). A per-subdirectory `COPY prisma ./prisma` failed
# in Chabokan's build context, so we copy everything at once. postinstall runs
# `prisma generate`, which needs prisma/schema.prisma (present in this copy).
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build
# NOTE: we intentionally do NOT run `pnpm prune --prod`. With pnpm, prune
# re-triggers the `postinstall` (prisma generate) lifecycle AFTER the `prisma`
# CLI devDependency has been removed, which fails the build ("prisma: not
# found"). Keeping all deps also guarantees the generated Prisma client stays
# intact. The image is slightly larger; we can slim it later with `pnpm deploy`.

# --- Runner: minimal, non-root production image ---
FROM base AS runner
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/package.json ./package.json
USER node
EXPOSE 4000
CMD ["node", "dist/server.js"]
