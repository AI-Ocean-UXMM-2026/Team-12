# Vercel deployment through GitHub Actions

The owner authorized Vercel deployment on 2026-10-22. The workflow is prepared; an actual deployment requires a connected Vercel project, hosted PostgreSQL and private S3-compatible storage. Local database files, seed passwords and private photos are not uploaded.

## Connect the accounts

1. Create a Vercel project for this application, with repository root as the root directory, Next.js as the framework and Node 24.x. Reserve its production domain before configuring authentication.
2. In GitHub repository **Settings → Secrets and variables → Actions**, add `VERCEL_TOKEN`, `VERCEL_ORG_ID` (Vercel team/account ID) and `VERCEL_PROJECT_ID`. Alternatively use the GitHub `production` environment secrets. Obtain the IDs from Vercel project settings or the ignored `.vercel/project.json` after linking locally. Give the token access to that project. Never commit or paste tokens into issues.
3. If Vercel deployment protection is enabled, add its automation bypass value as `VERCEL_AUTOMATION_BYPASS_SECRET` in GitHub so the final readiness request can reach the deployment.
4. Configure the following variables for the Vercel project's **Production** environment. Values used for builds must be available to `vercel pull`; non-downloadable sensitive variables need a separate secret injection arrangement before this workflow can build.

| Variable | Production value |
| --- | --- |
| `DATABASE_URL` | Hosted PostgreSQL URL with provider-required TLS, reachable from GitHub runners and Vercel. Must support Prisma migrations; use a migration-capable endpoint. |
| `APP_BASE_URL` | Canonical HTTPS production origin, without a trailing slash. |
| `AUTH_SECRET` | Independent random secret, at least 32 characters. |
| `TRACKING_HMAC_KEY` | Independent random secret, at least 32 characters. |
| `TRACKING_ENCRYPTION_KEY` | Independent random 32-byte key encoded as 64 hexadecimal characters. |
| `STORAGE_ADAPTER` | `s3` |
| `S3_BUCKET` | Existing private bucket with public access blocked. |
| `S3_REGION` | Provider region. |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Restricted private bucket credentials. |
| `S3_ENDPOINT` | Provider endpoint if required; omit for AWS S3 defaults. |
| `S3_FORCE_PATH_STYLE` | Provider-specific, usually `false` for AWS. |
| `BUSINESS_TIMEZONE`, `APP_CURRENCY`, `MONEY_DECIMAL_PLACES` | Existing defaults: `Asia/Yangon`, `MMK`, `2`. |
| `SMS_ENABLED` | `false`; deployment does not enable SMS. |

Do not configure `SEED_PASSWORD`, `LOCAL_PRODUCTION_TEST=true` or filesystem storage in Vercel. Generate fresh production keys; do not copy local development keys. Keep a private backup of encryption keys. Review forwarded-client-IP handling before enabling `TRUST_PROXY`.

## Run and verify

Push to `main`, or open GitHub **Actions → Application checks → Run workflow** and select `main`. CI runs the existing database, unit, HTTP and browser checks before calling the deployment workflow. Pull requests never deploy production. The deployment job serializes releases, validates configuration, builds with pinned Vercel CLI 65.0.0, applies committed migrations without seeding/resetting data, checks hosted database/storage, and deploys the prebuilt output. It then requests `/api/ready`. The deployment URL is recorded in the job summary. A failed post-deployment check does not automatically roll back a release or database migration.

`vercel.json` disables Vercel's independent Git deployments so pushes deploy through GitHub Actions. CLI deployments remain enabled. GitHub environment protection rules, if configured by the owner, still apply. Do not download or publish `.vercel` as an artifact: it contains pulled environment values.

Provision the first production Admin privately using `npm run admin:bootstrap` against the hosted database, as described in [OPERATIONS.md](OPERATIONS.md). Do not seed development accounts into production. Create Rider accounts from the authenticated Admin interface. The local login passwords do not exist in a fresh production database.

## Known hosting limitation

The current authorized photo endpoint sends multipart uploads through the application. Vercel Functions cap request and response bodies at 4.5 MB, while CUS/DRV requirements allow a 10 MB JPEG/PNG photo. Files over the host limit fail before application validation. No setting in this workflow removes that limit, and the 10 MB product requirement has not been reduced. Full compliance on Vercel requires a separately implemented authorized direct-to-private-storage upload flow with assignment-bound upload authorization, image validation, finalization and replay/concurrency protection, or a backend host accepting the existing 11 MiB multipart envelope. Small-photo workflows can run after infrastructure configuration; complete production acceptance remains outstanding.

References: [Vercel with GitHub Actions](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel), [Vercel pull](https://vercel.com/docs/cli/pull), [Function limits](https://vercel.com/docs/functions/limitations).
