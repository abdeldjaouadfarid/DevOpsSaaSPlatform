# Design: Architecture + NestJS API + PostgreSQL (Day-1 slice)

**Date:** 2026-09-21
**Scope:** First two rows of the roadmap in `Docs/Concept.md` —
"Architecture + إعداد المشروع" (1–2 days) and "NestJS API + PostgreSQL" (2–3 days).
**Explicitly out of scope for this spec:** Redis/BullMQ workers, GitHub webhooks,
Docker build/deploy pipeline, Nginx/HTTPS, dashboard, monitoring stack, Terraform/Ansible.
Those get their own specs when we reach them on the roadmap.

## Goal

Stand up the monorepo skeleton and a working NestJS + PostgreSQL API with:

- User registration & login (JWT).
- CRUD for `Project` (a user's connected GitHub repo, before we do any
  actual webhooks / builds).
- Read-only endpoints for `Deployment` (rows will be created by the
  worker in a later slice — for now the API just returns whatever is in
  the table, useful for seed data and future integration).
- Local dev environment via docker-compose (Postgres only for now).
- Test framework wired up (Jest unit + e2e) and pre-commit hooks.

The bar for "done today" is: `pnpm --filter api start:dev` boots, the
health check passes, and a user can `POST /auth/register`, `POST /auth/login`,
then create/list/update/delete their own projects with a JWT.

## Architecture decisions (with reasoning)

### D1. Monorepo with pnpm workspaces

The concept doc calls for at least three deployable units (API, worker,
dashboard) that will share types — the Prisma client, DTOs, deployment
status enums. A monorepo lets us import `@devops-saas/shared` from every
app without publishing a package. `pnpm` was chosen over `npm`/`yarn`
for its symlink-based node_modules (fast installs, disk-efficient) and
first-class workspace support.

Rejected: single-project-now-split-later (migration cost when adding the
worker), multi-repo (too much overhead for a solo dev).

### D2. Prisma at the repo root

Both the API and the future worker will need the Prisma client. Putting
`prisma/schema.prisma` at the root and generating the client into the
root `node_modules/@prisma/client` makes it importable from any workspace
package. Migrations live at the root too (`prisma/migrations/`).

### D3. NestJS with class-validator DTOs + Swagger UI

Standard Nest patterns:

- Global `ValidationPipe` with `{ whitelist: true, forbidNonWhitelisted: true, transform: true }`.
- DTOs use `class-validator` decorators for validation **and**
  `@nestjs/swagger`'s `@ApiProperty()` decorators for OpenAPI schema.
- `@nestjs/config` with a Zod validation schema — the app refuses to
  boot if a required env var is missing or malformed.
- **Swagger UI** mounted at `/docs` via `@nestjs/swagger`'s
  `SwaggerModule.setup('docs', app, document)`. The `DocumentBuilder`
  registers `addBearerAuth()` so you can paste a JWT in the "Authorize"
  button and hit protected endpoints straight from the browser.
  Available in `NODE_ENV=development` only by default (guarded in
  `main.ts`); flip an env flag to expose it in staging later.

### D4. Auth = JWT access tokens only, today

`passport-jwt` with a `JwtAuthGuard` registered globally via `APP_GUARD`.
A `@Public()` decorator (using `Reflector`) opens `/auth/*` and `/health`.
Passwords are hashed with `bcrypt` (12 rounds).

No refresh tokens, no password reset, no OAuth today — those belong in
V2. The JWT payload is `{ sub: userId, email }`, TTL 1 hour.

### D5. Prisma-based PrismaService as a global module

`PrismaService extends PrismaClient implements OnModuleInit` — calls
`this.$connect()` on init. `PrismaModule` is `@Global()` so any feature
module can inject it without re-importing.

### D6. Docker Compose for local Postgres

Postgres 16-alpine on port 5432, named volume `postgres_data`, healthcheck
via `pg_isready`. Redis will be added to the same compose file when we
reach the BullMQ slice. Devs run `docker compose -f infra/docker-compose.dev.yml up -d`.

### D7. Testing: Jest unit + e2e with a real Postgres

- **Unit tests** for services — mock `PrismaService` with
  `jest-mock-extended` (`DeepMockProxy<PrismaClient>`).
- **E2E tests** for controllers — spin up the full app against a
  separate test database (`devops_saas_test`), truncate tables between
  tests. This costs a few seconds per test file but catches real
  serialization / validation / guard behavior that mocked tests hide.

The concept doc emphasizes reliability; hitting a real DB in e2e is
worth the wall-clock cost.

## Repo layout

```
DevOpsSaaSPlatform/
├── apps/
│   └── api/
│       ├── src/
│       │   ├── main.ts
│       │   ├── app.module.ts
│       │   ├── config/
│       │   │   └── env.validation.ts
│       │   ├── prisma/
│       │   │   ├── prisma.module.ts
│       │   │   └── prisma.service.ts
│       │   ├── common/
│       │   │   ├── decorators/public.decorator.ts
│       │   │   └── guards/jwt-auth.guard.ts
│       │   ├── auth/
│       │   │   ├── auth.module.ts
│       │   │   ├── auth.service.ts
│       │   │   ├── auth.controller.ts
│       │   │   ├── jwt.strategy.ts
│       │   │   └── dto/{register.dto.ts,login.dto.ts}
│       │   ├── users/
│       │   │   ├── users.module.ts
│       │   │   ├── users.service.ts
│       │   │   └── users.controller.ts
│       │   ├── projects/
│       │   │   ├── projects.module.ts
│       │   │   ├── projects.service.ts
│       │   │   ├── projects.controller.ts
│       │   │   └── dto/{create-project.dto.ts,update-project.dto.ts}
│       │   ├── deployments/
│       │   │   ├── deployments.module.ts
│       │   │   ├── deployments.service.ts
│       │   │   └── deployments.controller.ts
│       │   └── health/
│       │       ├── health.module.ts
│       │       └── health.controller.ts
│       ├── test/
│       │   ├── auth.e2e-spec.ts
│       │   ├── projects.e2e-spec.ts
│       │   └── setup.ts
│       ├── tsconfig.json
│       ├── tsconfig.build.json
│       ├── nest-cli.json
│       └── package.json
├── packages/
│   └── shared/                 # populated in a later slice (empty stub today)
│       ├── src/index.ts
│       ├── tsconfig.json
│       └── package.json
├── infra/
│   └── docker-compose.dev.yml
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/             # created by first `prisma migrate dev`
├── Docs/
│   ├── Concept.md
│   └── superpowers/specs/…
├── .env.example
├── .gitignore
├── package.json                # workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .eslintrc.cjs
├── .prettierrc
├── .husky/pre-commit
└── README.md
```

## Data model (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  projects Project[]
}

model Project {
  id      String @id @default(uuid())
  name    String
  repoUrl String // GitHub URL (webhook wiring comes later)
  ownerId String
  owner   User   @relation(fields: [ownerId], references: [id], onDelete: Cascade)

  deployments Deployment[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([ownerId, name])
}

enum DeploymentStatus {
  PENDING
  BUILDING
  DEPLOYING
  SUCCESS
  FAILED
}

model Deployment {
  id         String           @id @default(uuid())
  projectId  String
  project    Project          @relation(fields: [projectId], references: [id], onDelete: Cascade)
  commitSha  String?
  status     DeploymentStatus @default(PENDING)
  logs       String?          // truncated; full logs to object storage in a later slice
  startedAt  DateTime         @default(now())
  finishedAt DateTime?

  @@index([projectId, startedAt])
}
```

## API surface

All responses are JSON. All authenticated endpoints require
`Authorization: Bearer <jwt>`. All list endpoints return arrays scoped
to `req.user.sub`. Ownership is enforced in the service layer: fetching
a project or deployment that isn't yours returns `404`, not `403`, to
avoid leaking existence.

| Method | Path                         | Auth   | Body / Query                | Response                       |
|-------:|------------------------------|--------|-----------------------------|--------------------------------|
| GET    | `/docs`                      | public (dev only) | —                | Swagger UI (HTML)              |
| GET    | `/docs-json`                 | public (dev only) | —                | OpenAPI 3 JSON                 |
| GET    | `/health`                    | public | —                           | `{ status: "ok" }`             |
| POST   | `/auth/register`             | public | `{ email, password }`       | `{ user, accessToken }`        |
| POST   | `/auth/login`                | public | `{ email, password }`       | `{ user, accessToken }`        |
| GET    | `/users/me`                  | jwt    | —                           | `{ id, email, createdAt }`     |
| GET    | `/projects`                  | jwt    | —                           | `Project[]`                    |
| POST   | `/projects`                  | jwt    | `{ name, repoUrl }`         | `Project`                      |
| GET    | `/projects/:id`              | jwt    | —                           | `Project` + last 10 deployments|
| PATCH  | `/projects/:id`              | jwt    | partial `{ name?, repoUrl? }` | `Project`                    |
| DELETE | `/projects/:id`              | jwt    | —                           | `204`                          |
| GET    | `/projects/:id/deployments`  | jwt    | `?limit=&cursor=`           | `Deployment[]`                 |
| GET    | `/deployments/:id`           | jwt    | —                           | `Deployment`                   |

Validation rules on DTOs:

- `email`: `@IsEmail()`.
- `password`: `@IsString() @MinLength(8) @MaxLength(72)` (bcrypt input cap).
- `name`: `@IsString() @Matches(/^[a-z0-9-]{1,64}$/)` (slug-ish, so it's URL-safe later).
- `repoUrl`: `@IsUrl({ protocols: ['https'] }) @Matches(/^https:\/\/github\.com\//)`.

## Environment variables

| Var              | Required | Example                                                    | Purpose                    |
|------------------|:--------:|------------------------------------------------------------|----------------------------|
| `NODE_ENV`       | ✓        | `development`                                              | mode                       |
| `PORT`           | ✓        | `3000`                                                     | API listen port            |
| `DATABASE_URL`   | ✓        | `postgresql://devops:devops@localhost:5432/devops_saas`    | Postgres DSN               |
| `JWT_SECRET`     | ✓        | 32+ random bytes                                           | HMAC key for access tokens |
| `JWT_EXPIRES_IN` | ✓        | `1h`                                                       | access token TTL           |
| `CORS_ORIGIN`    | ✓        | `http://localhost:5173`                                    | dashboard origin (later)   |
| `SWAGGER_ENABLED`| ✗        | `true`                                                     | force-enable Swagger UI outside dev (default: on if `NODE_ENV=development`) |

`env.validation.ts` uses Zod (small, no runtime deps beyond zod itself)
and calls `envSchema.parse(process.env)` in the `ConfigModule.forRoot`
`validate` hook. Missing/malformed vars → the app fails to boot with
a clear error.

## Local dev workflow

```bash
# one-time
cp .env.example .env
pnpm install

# every session
docker compose -f infra/docker-compose.dev.yml up -d
pnpm --filter api prisma:migrate:dev       # first time: pnpm --filter api prisma:migrate:dev --name init
pnpm --filter api start:dev
```

Scripts in `apps/api/package.json`:

- `start:dev` — `nest start --watch`
- `build` — `nest build`
- `test` — `jest`
- `test:e2e` — `jest --config test/jest-e2e.json`
- `prisma:generate` — `prisma generate --schema=../../prisma/schema.prisma`
- `prisma:migrate:dev` — `prisma migrate dev --schema=../../prisma/schema.prisma`
- `prisma:studio` — `prisma studio --schema=../../prisma/schema.prisma`

## Error handling

- Validation failures → Nest's built-in `BadRequestException` from
  `ValidationPipe`.
- Auth failures (bad password, missing JWT, expired JWT) → `401` with
  `{ statusCode, message }`. Never say "user not found" vs. "wrong
  password" — always the same generic message so we don't leak account
  enumeration.
- Ownership failures → `404` (same reason).
- Unique constraint violations (email or `(ownerId, name)`) →
  translated to `409 Conflict` by a custom `PrismaExceptionFilter`.
- Everything else → `500`, logged with a request id.

Every request gets a request id header (`x-request-id`), generated by
middleware if the client didn't send one. Logs use `pino` with
`pino-http` — structured JSON in prod, pretty-printed in dev.

## Security notes

- `helmet` middleware on by default.
- Global rate limit via `@nestjs/throttler` — 100 requests/minute per
  IP by default, `/auth/login` narrowed to 5/minute per IP to slow
  brute-force.
- Bcrypt cost 12 (safe default for 2026 hardware; revisit yearly).
- JWT `alg: HS256`, secret at least 32 bytes. Rotating the secret
  invalidates all tokens — acceptable pre-launch.
- CORS restricted to `CORS_ORIGIN`.

## Testing plan

**Unit (Jest, mocked Prisma):**

- `AuthService.register` — hashes password, rejects duplicate email,
  returns user + token.
- `AuthService.login` — accepts valid credentials, rejects wrong
  password without leaking which field was wrong.
- `ProjectsService.create` — sets `ownerId` from `req.user.sub`, rejects
  duplicate `(ownerId, name)`.
- `ProjectsService.findOne` — throws `NotFoundException` when a project
  belongs to another user.

**E2E (Jest + supertest, real Postgres `devops_saas_test`):**

- Full register → login → create project → list projects → delete
  project happy path.
- Cross-user isolation: user A cannot GET/PATCH/DELETE user B's
  project (all return 404).
- Rate limiter: 6th login attempt within 60s returns 429.

Test DB is truncated (not migrated) between tests using a shared helper
that `TRUNCATE`s all tables except `_prisma_migrations` in one statement.

## Tooling & CI-adjacent

- ESLint config: `@typescript-eslint/recommended` + Prettier (no conflicts).
- Prettier: 2-space indent, single quotes, trailing commas es5, print width 100.
- Husky pre-commit hook runs `lint-staged` (ESLint + Prettier on staged files).
- No GitHub Actions today — that's a later roadmap row.

## Deferred decisions (recorded so we don't relitigate)

- **File uploads / avatars** — no user avatars yet, so no storage need.
- **Email verification** — postponed until we have real users.
- **Rate limiter storage** — in-memory today (single instance);
  swap to Redis-backed when we scale out.
- **Log shipping** — pino → stdout for now; Loki later.

## Definition of done

- `pnpm install` at the repo root succeeds cleanly.
- `docker compose -f infra/docker-compose.dev.yml up -d` brings up Postgres and it passes healthcheck.
- `pnpm --filter api prisma:migrate:dev` creates the `User`, `Project`, `Deployment` tables plus the migration under `prisma/migrations/`.
- `pnpm --filter api start:dev` boots, `curl localhost:3000/health` returns `{"status":"ok"}`.
- `http://localhost:3000/docs` renders the Swagger UI with all endpoints listed, request/response schemas visible, and the "Authorize" flow working for bearer JWTs.
- All 10 authenticated endpoints work end-to-end via Swagger UI, curl, or Postman with a JWT.
- `pnpm --filter api test` and `pnpm --filter api test:e2e` both green.
- README documents the setup steps above.
