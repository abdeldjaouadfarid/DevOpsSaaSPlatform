# DevOps SaaS Platform

A scaled-down Vercel/GitHub-Actions clone for solo-developer scope.
See [`Docs/Concept.md`](Docs/Concept.md) for the vision and
[`Docs/superpowers/specs/`](Docs/superpowers/specs/) for design docs.

## What's here (Day 1)

- **`apps/api`** — NestJS 10 + TypeScript API
  (auth, users, projects, deployments read-only, health, Swagger UI at `/docs`)
- **`packages/shared`** — placeholder for cross-app types (empty stub)
- **`prisma/`** — root Prisma schema (User / Project / Deployment) + seed
- **`infra/docker-compose.dev.yml`** — local Postgres 16
- **Tests** — Jest unit + e2e (real Postgres against a `_test` database)

## Prerequisites

- Node.js 20.11+
- pnpm 9+
- Docker (for the local Postgres)

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
> Change [`infra/docker-compose.dev.yml`](infra/docker-compose.dev.yml) if you'd rather use a different host port.

## Run

```bash
pnpm api:dev
```

Then:

- API: <http://localhost:3000>
- Swagger UI: <http://localhost:3000/docs>
- Health: <http://localhost:3000/health>

Register, log in, click the **Authorize** button in Swagger UI, paste
`Bearer <token>` (or just the token — Swagger prepends the scheme
automatically), and every protected endpoint is now callable from the
browser.

## Test

```bash
pnpm api:test        # unit tests (Prisma mocked)
pnpm api:test:e2e    # e2e — needs the test DB running & migrated
```

## Scripts

| Script | Purpose |
|---|---|
| `pnpm api:dev`             | Watch mode Nest app |
| `pnpm api:build`           | Build the API |
| `pnpm db:up` / `db:down`   | docker-compose up/down for Postgres |
| `pnpm prisma:migrate:dev`  | Run Prisma migrations against `DATABASE_URL` |
| `pnpm prisma:studio`       | Open Prisma Studio |
| `pnpm lint`                | Lint every workspace |
| `pnpm format`              | Prettier over the repo |

## Endpoints (Day 1)

| Method | Path                              | Auth |
|-------:|-----------------------------------|------|
| GET    | `/health`                         | —    |
| GET    | `/docs`, `/docs-json`             | —    |
| POST   | `/auth/register`                  | —    |
| POST   | `/auth/login`                     | —    |
| GET    | `/users/me`                       | jwt  |
| GET    | `/projects`                       | jwt  |
| POST   | `/projects`                       | jwt  |
| GET    | `/projects/:id`                   | jwt  |
| PATCH  | `/projects/:id`                   | jwt  |
| DELETE | `/projects/:id`                   | jwt  |
| GET    | `/projects/:id/deployments`       | jwt  |
| GET    | `/deployments/:id`                | jwt  |

## Roadmap

Next up (from `Docs/Concept.md`): Redis + BullMQ + workers, then GitHub
webhooks, then Docker build/deploy.
