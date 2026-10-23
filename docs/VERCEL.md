# Vercel-native deployment

The owner requested Vercel's built-in GitHub integration on 2026-10-23, superseding GitHub Actions. Both Actions workflows have been removed. The repository root is the Next.js project root, Node 24 is selected in Vercel, and `vercel.json` uses `npm run build:vercel`. GitHub Actions secrets are not needed.

## Infrastructure

- Project: `team-12-ai-ocean` in `kyawkokotuns-projects`.
- Production origin: `https://team-12-ai-ocean.vercel.app`.
- PostgreSQL: dedicated `team-12-postgres` Neon free-plan database provisioned and connected through Vercel Marketplace in `iad1`. Vercel no longer offers its own PostgreSQL product; Marketplace manages provisioning, connection strings and billing in Vercel.
- Photos: PRIVATE Vercel Blob store `team-12-private-proof`, `iad1`. Raw uploads and processed evidence remain private. Hosted configuration needs no S3/MinIO.
- Daily Vercel Cron at `/api/cron/photos` cleans expired raw uploads and old unattached proof. `CRON_SECRET` protects it. Each run handles up to 100 of each; monitor for backlog as volume grows.

## GitHub deployment flow

Push the application to GitHub, then connect `AI-Ocean-UXMM-2026/Team-12` in Vercel Git settings, with `main` as the production branch. Subsequent pushes build and deploy automatically through Vercel. Removing `git.deploymentEnabled: false` enables native deployments. GitHub Actions no longer gates this flow. Run lint, typecheck and tests before pushing.

`build:vercel` generates Prisma, validates configuration, applies committed migrations using `DATABASE_URL_UNPOOLED` when present, optionally provisions the first Admin in an empty installation, and builds Next.js. It never seeds development accounts, resets data or replaces existing credentials. Migrations must remain compatible with the previous running release. A failed build does not undo migrations.

Production variables are scoped to Production. Previews require their own isolated database, private Blob store, independent secrets and matching `APP_BASE_URL`; never copy production credentials into untrusted branches. Builds fail on missing configuration. Preview verification is separate.

## Production configuration

| Variable | Value/source |
| --- | --- |
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | Injected by Vercel Marketplace; pooled runtime and unpooled migration URL. |
| `BLOB_READ_WRITE_TOKEN` | Injected by the private Blob store; server-only. |
| `APP_BASE_URL` | `https://team-12-ai-ocean.vercel.app` |
| `STORAGE_ADAPTER` | `vercel-blob` |
| `AUTH_SECRET`, `TRACKING_HMAC_KEY` | Independent random secrets, at least 32 characters. |
| `TRACKING_ENCRYPTION_KEY` | Independent random 32-byte key encoded as 64 hexadecimal characters. |
| `CRON_SECRET` | Independent random secret for authenticated Vercel Cron. |
| `SMS_ENABLED` | `false` |
| `TRUST_PROXY` | `true` behind Vercel's trusted proxy; do not expose untrusted ingress. |
| `BUSINESS_TIMEZONE`, `APP_CURRENCY`, `MONEY_DECIMAL_PLACES` | `Asia/Yangon`, `MMK`, `2` |
| `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_PASSWORD` | Temporary first-Admin settings. Only create if no Admin exists. Remove after initial deployment. |

Never enable filesystem storage, `SEED_PASSWORD` or `LOCAL_PRODUCTION_TEST` in Vercel. The ignored `.local/vercel-production-secrets.json` holds initial access details generated on the owner's computer; keep it private. Change the initial Admin password at first sign-in. Back up encryption keys privately; never commit them.

## Photo handling

The Rider UI requests an assignment-bound upload ticket. The token route checks active Rider identity and current ownership, then grants a 15-minute permission for one immutable path, JPEG/PNG types and a 10 MiB maximum. The browser uploads to PRIVATE Blob directly, bypassing the Function request-body limit. Tokens cannot overwrite, list or read objects.

Finalization sends only the ticket ID and result metadata. The server rechecks ownership, fetches raw bytes by the database's exact key, validates and re-encodes with sharp, strips EXIF, writes separate private JPEG proof and attaches it through the existing versioned/idempotent transaction. Corrupt files, stale versions, former/revoked Riders and storage failures do not record delivery. Raw bytes never become operational proof. Twenty-four-hour raw retention supports retries; authenticated daily Cron removes expired uploads. Evidence reads reauthorize Admin/current Rider and stream bytes, including photos above 4.5 MB.

## Verification

Check `/api/ready` for database AND private Blob connectivity after release. Verify public tracking, operational access denial, Admin login/setup, Rider ownership, direct photo delivery, replay and notifications. A passing build alone is insufficient. Actual results are in `ACCEPTANCE.md` and `PROGRESS.md`.

References: [Vercel GitHub](https://vercel.com/docs/git/vercel-for-github), [Marketplace PostgreSQL](https://vercel.com/docs/postgres), [private Blob](https://vercel.com/docs/vercel-blob/private-storage), [client uploads](https://vercel.com/docs/vercel-blob/client-upload), [Cron](https://vercel.com/docs/cron-jobs).
