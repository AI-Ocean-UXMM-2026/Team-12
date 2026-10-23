# Parcel Delivery Management and Tracking

Next.js App Router and strict TypeScript application with Admin, Rider and customer interfaces. Operational records use PostgreSQL through Prisma. Authenticated server services enforce role/assignment ownership, transactions, stale-write detection and durable idempotency. Hosted photos use PRIVATE Vercel Blob with direct browser uploads; local development also supports private S3-compatible storage and a durable filesystem fallback. No operational arrays or browser localStorage remain.

## Vercel hosting

Production uses Vercel's built-in GitHub integration, Vercel Marketplace PostgreSQL and PRIVATE Vercel Blob. GitHub Actions workflows have been removed at the owner's request. Pushes to connected `main` deploy with `npm run build:vercel`, applying committed migrations without development seeding. Direct uploads support the full 10 MiB photo limit. Daily authenticated Vercel Cron cleans expired staging. See [deployment configuration](docs/VERCEL.md) and [actual verification](docs/ACCEPTANCE.md).

## Local setup

Use Node 24 and npm. On Windows with PowerShell script execution disabled, use `npm.cmd` instead of `npm`. Keep this repository as the app root.

```sh
npm ci
npm run env:local
docker compose up -d
npm run db:deploy
npm run storage:init
npm run db:seed
npm run dev
```

`env:local` creates an ignored `.env` with random server keys and `SEED_PASSWORD`; it refuses to overwrite an existing file. Review `.env` before continuing. Compose binds PostgreSQL and MinIO to loopback and retains their data in volumes. Do not use `docker compose down -v` if you want to retain data. `db:deploy` applies committed migrations without resetting data. Seed requires explicit `NODE_ENV=development`, provisions `admin@parcel.test` and `rider1@parcel.test` through `rider5@parcel.test`, and creates five parcel fixtures covering unassigned, assigned, unreachable, preference changes and delivered proof. Their private local password is `SEED_PASSWORD` in `.env`; it is never printed by seed and no credentials are committed.

Open [localhost:3000](http://localhost:3000). Staff sign in at `/login`. Admins create Riders and receive a setup password once; Riders must change it at first sign-in. Customers and Admins use the same **parcel code** (for example `P-…`) at `/track`. Admins can also search by parcel code in `/admin/parcels` and open full details. No separate tracking code, customer login or SMS is needed. Riders see dated assignments and notifications and can submit unreachable attempts or successful delivery with one photo.

The customer entry (`/`, redirecting to `/track`) shows tracking and receiving preferences only. The Rider portal (`/rider/assignments`) has My Deliveries, a notification bell and sign-out; it contains no customer/Admin workspace links. `/login` is the separate staff sign-in page. Existing Admin screens remain available for a later interface pass.

Rider delivery lists always use the signed-in Rider and selected delivery date, defaulting to today in the business timezone. Changing a Rider ID in a request cannot show another Rider's work. If an Admin session opens the Rider portal, it shows a Rider-account sign-in prompt instead of returning to the Admin workspace.

If MinIO is unavailable, explicitly set `STORAGE_ADAPTER=filesystem` and `PRIVATE_STORAGE_PATH=.local/private-objects` in `.env`. Then start only PostgreSQL (`docker compose up -d postgres`), run `npm run storage:init`, migrate, seed and start normally. This stores real durable private files outside `public`; it is not MinIO verification. The filesystem adapter is refused in production unless the explicit loopback test flag is set.

## This Windows workspace

The installed system Node 22.11 cannot run the locked Prisma version. A Node 24.22 runtime and PostgreSQL 18.4 binaries were downloaded under ignored `.local` for verification; the system installation was not changed. PostgreSQL's local development cluster uses loopback and trust authentication and must never be exposed or used for production. Start it after a restart using:

```powershell
& '.local/postgres/node_modules/@embedded-postgres/windows-x64/native/bin/pg_ctl.exe' -D '.local/pgdata' -l '.local/postgres.log' -o '-p 5432 -h 127.0.0.1' -w start
node scripts/run-local.mjs dev
```

`node scripts/run-local.mjs <script-name>` runs an npm script using this project-local Node 24. For example, `node scripts/run-local.mjs test` or `node scripts/run-local.mjs db:deploy`. This optional helper requires the ignored runtime already present on this machine; a fresh clone should install Node 24 normally. Windows may require permission to start local service processes.

## Verification commands

```sh
npm run db:validate
npm run lint
npm run typecheck
npm test
# With the app running against synthetic local data:
EXPECT_STORAGE=true npm run test:integration
npm run test:outbox
npm run test:maintenance
npm run test:e2e
npm run test:performance -- --seed
# Explicit local production-build validation, never a public deployment:
LOCAL_PRODUCTION_TEST=true npm run build
LOCAL_PRODUCTION_TEST=true npm start
```

PowerShell sets variables separately: `$env:EXPECT_STORAGE='true'` or `$env:LOCAL_PRODUCTION_TEST='true'`. Integration/browser checks write additional synthetic fixtures and must not target production. Set `EXPECT_STORAGE=true` for the complete photo journey; omitting it tests the explicit unavailable-storage failure scenario and requires storage to be unavailable. Playwright uses installed Chrome on this Windows machine, otherwise `npx playwright install chromium`; `PLAYWRIGHT_EXECUTABLE_PATH` can specify a browser. Browser traces are disabled to avoid capturing bearer codes and credentials.

The performance command seeds up to 100 benchmark parcels, as requested by the owner, and measures 20 concurrent readers. It preserves existing fixtures and prints aggregate counts and timings only.

Parcel tracking does not use SMS and parcel creation does not enqueue SMS. The existing optional outbox maintenance tools remain for compatibility with historical events. `npm run photos:cleanup` removes only old unattached staged objects. See [operations](docs/OPERATIONS.md) for production config, request limits, backup/restore and key custody.

## Defaults and limits

Expected delivery is scheduled delivery date plus three calendar days. Unreachable maps to Delay and can be retried. Successful delivery requires one valid JPEG/PNG, at most 10 MiB. Delivered is terminal. Preferences may change before delivery. Currency is MMK with two decimal places; changing the supported scale requires a migration. Business dates default to Asia/Yangon. The parcel code grants access to the minimal customer tracking view and receiving preferences through a 30-minute HttpOnly parcel-scoped session. Admin/Rider operational details and photos still require authenticated ownership. SMS is not needed. The owner-authorized hosted application is at [team-12-ai-ocean.vercel.app](https://team-12-ai-ocean.vercel.app).

Read [decisions](docs/DECISIONS.md), [progress](docs/PROGRESS.md), and [actual acceptance evidence](docs/ACCEPTANCE.md). Hosted PostgreSQL and private Vercel Blob have passed the deployment journey, including a photo above 4.5 MB. Backup/restore rehearsal and isolated Preview infrastructure remain separate operational work; do not infer those from the passing deployment tests.

For the owner-authorized Vercel deployment, see [docs/VERCEL.md](docs/VERCEL.md). Vercel manages the connected Marketplace database and private Blob store; GitHub Actions secrets are not needed.
