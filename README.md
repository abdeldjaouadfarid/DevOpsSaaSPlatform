# DevOps SaaS Platform

A scaled-down Vercel/GitHub-Actions clone for solo-developer scope.
See `Docs/Concept.md` for the vision and `Docs/superpowers/specs/` for
design docs (Docs/ is git-ignored — kept local, not distributed).

## What's here (Day 1 + 2)

- **`apps/api`** — NestJS 10 + TypeScript API
  (auth, users, projects, deployments, health, Swagger UI at `/docs`)
- **`apps/api/src/queue`** — BullMQ queue + stubbed deployment pipeline
  (BUILDING → DEPLOYING → SUCCESS/FAILED), Bull Board UI at `/admin/queues`
- **`packages/shared`** — placeholder for cross-app types (empty stub)
- **`prisma/`** — root Prisma schema (User / Project / Deployment) + seed
- **`infra/docker-compose.dev.yml`** — local Postgres 16 + Redis 7
- **Tests** — Jest unit + e2e (real Postgres against a `_test` database)

## Prerequisites

- Node.js 20.11+
- pnpm 9+
- Docker (for the local Postgres and Redis)

## Setup

```bash
cp .env.example .env
pnpm install
pnpm db:up
pnpm prisma:migrate:dev --name init
```

If it's the first run, migrate on the test DB too:

```bash
DATABASE_URL="postgresql://devops:devops@localhost:5434/devops_saas_test?schema=public" \
  pnpm prisma:migrate:dev --name init
```

> The container maps host port **5434 → container 5432** so it doesn't
> conflict with a system PostgreSQL (5432) or other project containers.
> Redis maps **6379:6379**. Change `infra/docker-compose.dev.yml` if
> you'd rather use different host ports.

## Run

```bash
pnpm api:dev
```

Then:

- API: <http://localhost:3000>
- Swagger UI: <http://localhost:3000/docs>
- Health: <http://localhost:3000/health>
- Bull Board (dev only): <http://localhost:3000/admin/queues>

Register (needs `email`, `password`, `firstName`, `lastName`), log in,
click **Authorize** in Swagger UI, paste the JWT, and every protected
endpoint is now callable from the browser.

### End-to-end deployment demo

1. `POST /auth/register` → get a token.
2. `POST /projects` → create a project (name is a lowercase slug).
3. `POST /projects/{id}/deployments` with `{ "commitSha": "abc1234" }`
   → returns a row with `status: PENDING`.
4. Within ~2 seconds, `GET /projects/{id}/deployments` shows it at
   `SUCCESS` with build/deploy log lines.
5. To exercise the failure path, POST with `{ "commitSha": "FAIL" }`.
   After 3 retry attempts the row settles at `FAILED`. See it in
   Bull Board → Failed tab.

## Test

```bash
pnpm api:test        # unit tests (Prisma + Queue mocked)
pnpm api:test:e2e    # e2e — needs Postgres AND Redis running
```

## Scripts

| Script                    | Purpose                                      |
| ------------------------- | -------------------------------------------- |
| `pnpm api:dev`            | Watch mode Nest app                          |
| `pnpm api:build`          | Build the API                                |
| `pnpm db:up` / `db:down`  | docker-compose up/down for Postgres + Redis  |
| `pnpm prisma:migrate:dev` | Run Prisma migrations against `DATABASE_URL` |
| `pnpm prisma:studio`      | Open Prisma Studio                           |
| `pnpm lint`               | Lint every workspace                         |
| `pnpm format`             | Prettier over the repo                       |

## Endpoints

| Method | Path                        | Auth |
| -----: | --------------------------- | ---- |
|    GET | `/health`                   | —    |
|    GET | `/docs`, `/docs-json`       | —    |
|    GET | `/admin/queues` (dev only)  | —    |
|   POST | `/auth/register`            | —    |
|   POST | `/auth/login`               | —    |
|    GET | `/users/me`                 | jwt  |
|    GET | `/projects`                 | jwt  |
|   POST | `/projects`                 | jwt  |
|    GET | `/projects/:id`             | jwt  |
|  PATCH | `/projects/:id`             | jwt  |
| DELETE | `/projects/:id`             | jwt  |
|    GET | `/projects/:id/deployments` | jwt  |
|   POST | `/projects/:id/deployments` | jwt  |
|    GET | `/deployments/:id`          | jwt  |

## Security notes

- **Bull Board has no auth today.** It exposes queue internals. It is
  auto-disabled when `NODE_ENV=production`. Before any staging deploy,
  put it behind an auth guard or drop it.

## Roadmap

Next up (from `Docs/Concept.md`): GitHub webhooks, then Docker
build/deploy, then Nginx + HTTPS.
