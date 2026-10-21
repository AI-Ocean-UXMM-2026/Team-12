# Parcel Delivery Next.js Code Starter

A runnable Next.js App Router code scaffold for the Parcel Delivery Management and Tracking System. It includes TypeScript, Tailwind CSS, Prisma/PostgreSQL, private S3 storage configuration, Docker Compose, tests and the full PRD/implementation plan.

## What works now

- Next.js routes/layouts and responsive workspace navigation.
- A read-only sample Rider list with five synthetic Riders and live name/mobile filters.
- Customer, admin, Rider and login route foundations that identify pending workflows.
- Domain helpers for result/status mapping, photo requirements and calendar-date calculation.
- Shared Rider validation, Prisma schema and initial SQL migration, development seed, database/S3 client factories and liveness endpoint.
- Unit-test and browser-test configurations and a GitHub Actions starter workflow.

This is a code starter, not the completed product. Authentication, role/ownership enforcement, operational APIs, live database-backed screens, upload/result workflows, notifications and the SMS worker still need implementation. No private or operational data is exposed: only synthetic UI fixtures are connected. Do not connect real data until authorization is implemented.

## Requirements

- Node.js 24 (see `.nvmrc`) and npm.
- Docker with Compose for local PostgreSQL/MinIO, if running database commands.
- No database or external credentials are needed just to preview the starter screens.

## Run the starter

```bash
npm ci
npm run dev
```

Open http://localhost:3000. `npm ci` generates the Prisma client automatically. The preview does not read the database. On Windows, use the same npm commands in PowerShell.

## Local services and database

Copy `.env.example` to `.env` using your editor, or `cp .env.example .env` on macOS/Linux and `Copy-Item .env.example .env` in PowerShell. The template contains local-development defaults only.

```bash
npm run services:up
npm run db:deploy
npm run db:seed
```

The migration deployment command applies committed migrations. For later schema changes, use `npm run db:migrate -- --name describe_change` and review generated SQL. Do not use reset commands against production.

The seed is restricted to explicit `NODE_ENV=development` and creates only five synthetic Rider profiles, without login accounts or parcels. It is idempotent by fixture ID. Authentication and complete operational fixture generation remain for Codex.

PostgreSQL listens on localhost:5432. MinIO API is localhost:9000 and console is http://localhost:9001. Console credentials for local development are `parcel_local` / `parcel_local_secret_change_me`. The Compose file binds services to localhost only. Create the `parcel-proof-private` bucket in the console and keep anonymous/public access disabled. No upload API is implemented yet. Never use these credentials in production.

Stop services with `npm run services:down`; named volumes retain data. Deleting volumes removes the local database and objects.

## Checks

```bash
npm run db:validate
npm run lint
npm run typecheck
npm test
npm run build
npm run test:smoke
npx playwright install chromium
npm run test:e2e
```

The HTTP smoke command starts the built production server, checks routes and stops it. The Playwright browser test starts the dev server automatically. Unit tests cover the included domain rules; these are not full PRD acceptance tests. See `docs/ACCEPTANCE.md` for actual executed results and remaining checks.

`GET /api/health` reports app liveness only. It does not report database, storage or product readiness.

## Code layout

```text
src/
  app/
    (public)/track/
    (auth)/login/
    (admin)/admin/{riders,parcels,assignments}/
    (rider)/rider/{assignments,notifications}/
    api/health/
  components/             shared shell, sample table, starter states
  domain/                 delivery enums and business helpers
  lib/                    database, storage, dates and validation
  server/                 policies, services, repositories, notifications, sms
prisma/
  schema.prisma
  migrations/
  seed.ts
workers/                  future outbox worker boundary
tests/                   unit, integration and browser tests
docs/                    PRD, plan, decisions and verification
```

Database client code is generated into `src/generated/prisma` and deliberately excluded from Git/ZIP. npm install regenerates it. Dependencies, build output and real `.env` files are also excluded.

## Continue with Codex

Open this folder as the repository root. Read `AGENTS.md` and paste the prompt from `CODEX_START.md`. Codex should inspect the existing scaffold, preserve compatible work and continue from the remaining phase-1 tasks in `docs/PROGRESS.md`. Do not run create-next-app over this folder or regenerate the project unnecessarily.

The PRD source is `docs/PRD.docx`, with searchable extraction in `docs/PRD.md`. The full implementation contract is `docs/IMPLEMENTATION_PLAN.md`; provisional business decisions are recorded separately.

## Deployment

Public deployment is not part of this starter. Before deployment, complete authentication/authorization, private upload validation, transactional domain services, persistent production rate limiting, migrations/storage/backup configuration and full acceptance verification. Real SMS stays disabled pending explicit provider configuration and authorization. Preserve the full source specification and reconcile schema changes with it.
