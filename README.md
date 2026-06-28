# Viso backend

A type-safe Node + Fastify + Prisma API on PostgreSQL. Locally the database runs
in **Docker** and the API runs on your machine with hot-reload — one command
brings both up. Production runs on **Liara** with its managed PostgreSQL: same
code, different `DATABASE_URL`.

## Stack

| Concern        | Choice                                                                 |
| -------------- | --------------------------------------------------------------------- |
| Runtime        | Node 22 LTS, **ESM** (`"type": "module"`)                              |
| Package manager| **pnpm**                                                              |
| Language       | TypeScript 5 (strict, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`), `@tsconfig/node22` |
| Dev / Build    | **tsx** (watch) for dev · **tsup** (esbuild) → ESM bundle for prod    |
| Web framework  | Fastify 5 with `fastify-type-provider-zod` (zod schemas → runtime validation + inferred types) |
| Plugins        | `@fastify/autoload` (auto-registers `src/plugins/**` and `src/routes/**`) |
| API docs       | `@fastify/swagger` + `@fastify/swagger-ui` at **`/docs`**, generated from the zod schemas |
| Hardening      | `@fastify/helmet`, `@fastify/rate-limit`, `@fastify/cors`, `@fastify/sensible`, `@fastify/under-pressure` |
| Errors / logs  | Centralized zod-aware error handler · pino (pino-pretty in dev only)  |
| Database       | Prisma 6, standard client, singleton in `src/lib/db.ts`              |
| Lint + format  | **Biome** · **Vitest** for tests · **lefthook** pre-commit hook       |

## Project layout

```
src/
  app.ts              # buildApp() factory — zod compilers + autoload (used by tests)
  server.ts           # listen on PORT/HOST + graceful shutdown (the only entrypoint)
  lib/
    env.ts            # zod-validated environment (fails fast)
    db.ts             # Prisma singleton client
  plugins/            # cross-cutting, fastify-plugin-wrapped (autoloaded first)
    cors.ts  helmet.ts  rate-limit.ts  sensible.ts  swagger.ts  under-pressure.ts
    error-handler.ts
  routes/             # feature route plugins (autoloaded after plugins)
    health.ts         # GET /health → { status, db } via SELECT 1
    track.ts submit.ts            # public funnel ingestion + final lead
    analytics.ts submissions.ts   # admin read side (bearer-protected)
  schemas/            # shared zod schemas (frontend contracts; share where practical)
  lib/                # env, db, auth, ip-hash, derive, query, constants, track-id
prisma/schema.prisma  # Session, Event, Submission (+ enums)
Dockerfile            # multi-stage prod image · liara.json · docker-compose.yml (dev DB)
```

`buildApp()` (in `src/app.ts`) builds a fully-wired Fastify instance without
listening — tests use `app.inject(...)`. `server.ts` only binds the port.

## One-time prerequisites

1. **Docker Desktop** — https://www.docker.com/products/docker-desktop/ (start it, wait for "running"). Verify: `docker --version`.
2. **Node.js 22+** — https://nodejs.org. Verify: `node --version`.
3. **pnpm** — `corepack enable` (ships with Node), or `npm i -g pnpm`. Verify: `pnpm --version`.

## First run (dev)

```sh
cp .env.example .env   # local credentials + connection string
pnpm install           # installs deps and generates the Prisma client
pnpm dev               # starts the database (Docker) AND the API (hot-reload)
```

`pnpm dev` runs `docker compose up -d` (PostgreSQL + Adminer) then
`tsx watch src/server.ts`. On the very first run the Postgres image downloads;
give it ~10 seconds to be ready.

### Verify it works
- **Health:** http://localhost:4000/health → `{ "status": "ok", "db": "connected" }`
- **API docs:** http://localhost:4000/docs (Swagger UI)
- **DB viewer:** http://localhost:8080 (Adminer) → System **PostgreSQL**, Server **`db`**, user/password/db from `.env`.

## The green gate (run before every commit)

```sh
pnpm typecheck   # tsc --noEmit
pnpm lint        # biome check .   (use `pnpm lint:fix` to autofix)
pnpm test        # vitest run
pnpm build       # tsup → dist/ (ESM)
pnpm check       # all four in sequence
```

A **lefthook** pre-commit hook runs Biome (with autofix) + typecheck on staged
files automatically.

> `pnpm test` runs **integration tests against a real database** (an isolated
> `viso_test` schema in the local dev DB), so the dev database must be up first
> (`pnpm db:up`). `test/global-setup.ts` creates and syncs the schema; each test
> resets its tables.

## API (campaign validation)

All shapes are zod schemas in `src/schemas` and appear in Swagger at `/docs`.

**Public** (rate-limited, body-size capped, beacon-tolerant):
- `POST /v1/track` — funnel/telemetry ingestion. Accepts batches and
  `navigator.sendBeacon` (text/plain or octet-stream). Upserts the Session by
  `trackId`, dedupes events by `(sessionId, clientEventId)`, validates-and-skips
  bad events, replies `202 { ok: true }`.
- `POST /v1/submit` — final survey + lead. Flips the Session to `COMPLETED` and
  idempotently creates/updates the single `Submission` (keyed on session),
  deriving the curated columns. Replies `{ ok: true, id }`.

**Admin** (require `Authorization: Bearer $ADMIN_API_KEY`; not in public CORS):
- `GET /v1/analytics/funnel` — drop-off per questionNumber and per qid + started/
  completed/abandoned totals.
- `GET /v1/analytics/overview` — conversion by campaign/source, band &
  pilotInterest distributions, firmographics.
- `GET /v1/submissions` — paginated leads. `GET /v1/submissions/export.csv` — CSV.

Filters (admin): `from`, `to`, `campaignAid`, `utmSource`, `utmCampaign` (plus
`band`, `pilotInterest`, `region` on submissions).

> **Scoring decision (flagged):** `/v1/submit` trusts the client-computed
> `overallScore`/`band`/money figures, but always stores full
> `answers`/`controllers`/`rawPayload` so the server can recompute
> authoritatively later. Porting the Excel scoring + money model server-side is
> an optional follow-up.

> The curated-column → questionKey mapping lives in `src/lib/derive.ts` — adjust
> those keys to match the real frontend questionKeys.

## Dev vs. build vs. deploy

- **Dev:** `pnpm dev` — Docker DB + `tsx watch` (extensionless imports resolved by esbuild, hot-reload).
- **Build:** `pnpm build` — tsup compiles `src/**` to ESM in `dist/`, preserving the tree so autoload finds `dist/plugins` / `dist/routes` at runtime. `pnpm start` runs `node dist/server.js`.
- **Deploy:** see below.

## Everyday commands
- Start everything: `pnpm dev`
- Stop the database: `pnpm db:down` (stop the API with Ctrl+C)
- Wipe the database: `pnpm db:reset`
- Prisma Studio (visual DB editor): `pnpm prisma:studio`

## Deploy to Liara

The app boots from **env vars alone** — never commit secrets. In the Liara
dashboard create a **PostgreSQL** database and set the app's env vars:

| Var             | Value                                             |
| --------------- | ------------------------------------------------- |
| `DATABASE_URL`  | the connection string Liara gives you             |
| `CORS_ORIGIN`   | your frontend's domain (e.g. `https://app.viso…`)  |
| `NODE_ENV`      | `production`                                       |
| `ADMIN_API_KEY` | bearer token for the admin endpoints (≥16 chars)  |
| `IP_HASH_SALT`  | random salt for hashing respondent IPs (≥16 chars) |

After the first deploy, apply the schema to Liara's database with
`pnpm prisma migrate deploy` (pointed at the production `DATABASE_URL`).

`PORT` is injected by Liara; the app listens on it (host `0.0.0.0`).

**Primary path — Docker platform** (reproducible; `liara.json` has `"platform": "docker"`):
```sh
liara deploy            # builds the Dockerfile and deploys
```
Edit `app` in `liara.json` to match your Liara app name (or pass `--app NAME`).

**Alternative — Node platform.** Set `"platform": "node"` and add
`"node": { "version": "22" }` in `liara.json`; Liara then runs the `build`
script and starts via `node dist/server.js` (`main` in package.json).

The local `docker-compose.yml` is for the **dev database only** and is not used
in production.

## Prisma notes
- Standard Prisma client (singleton in `src/lib/db.ts`). Liara runs a normal
  long-lived Node server, so **edge/serverless driver adapters are not needed**.
- Typed SQL for hand-written analytics later: add `previewFeatures = ["typedSql"]`
  to the generator and run `prisma generate --sql`.
- Data model: `Session` (one per attempt, with attribution + progress),
  `Event` (funnel/telemetry stream), `Submission` (one lead per session). The
  funnel analytics use raw SQL (`COUNT(DISTINCT …)`); the rest uses the typed
  client. "Abandoned" is **derived** (IN_PROGRESS + `lastSeenAt` older than
  `ABANDON_THRESHOLD_MS`), never stored.

## Iran note — if Docker image downloads hang/fail
Docker Desktop → **Settings → Docker Engine**, add a mirror, Apply & Restart:
```json
{ "registry-mirrors": ["https://docker.arvancloud.ir"] }
```

## Migrated from the original scaffold
- **npm → pnpm** (lockfile is now `pnpm-lock.yaml`).
- **CommonJS → ESM** (extensionless imports; esbuild/tsx/tsup resolve them).
- **ESLint/Prettier → Biome** (single tool for lint + format).
