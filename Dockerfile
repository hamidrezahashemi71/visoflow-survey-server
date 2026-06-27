# Multi-stage build for the Viso backend (Fastify + Prisma, ESM on Node 22).
# The image boots entirely from environment variables — no secrets are baked in.

FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# --- Build: install all deps, generate the Prisma client, bundle with tsup ---
FROM base AS build
# Copy manifests first for better layer caching. The Prisma schema is required
# here because `postinstall` runs `prisma generate`.
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
# Drop devDependencies; the generated Prisma client (a prod dependency) stays.
RUN pnpm prune --prod

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
