# Acceptance and verification record

Updated 2026-10-22. Results below concern real PostgreSQL and the explicitly labeled private filesystem fallback. MinIO/S3 provider integration is not passed. Earlier scaffold-only results remain in git history and are superseded by this record.

## Parcel-code tracking owner update

The owner replaced separate private tracking codes/SMS with parcel-code lookup for customers and Admins. Updated tests exchange `parcelCode`, check authorized Admin code search, and verify that no tracking secret/SMS status is returned and parcel creation queues no SMS. Verified after rebuilding/restarting the local production-mode app: strict TypeScript and ESLint passed; both browser journeys passed using parcel codes; the full HTTP/authorization/concurrency suite passed; all 27 unit tests passed. Existing parcel codes work without a data migration. Earlier secret-code evidence below describes the previous baseline and is superseded by this update.

## Customer and Rider interface separation

Follow-up Rider scope check: added a wrong-account prompt for Admin sessions visiting Rider URLs, so those routes never show Admin navigation. The list API always derives Rider identity from the authenticated session and applies a selected date or business-today default. Passed lint, strict typecheck and production build. All four browser tests passed, including the wrong-account route and selected-date switching. The HTTP suite passed, including both Rider scopes, a forged Rider filter that cannot override ownership, and an alternate date that does not return the parcel. Rebuilt app restarted on localhost.

Owner requested CUS-01/CUS-02 customer-only pages and a My Deliveries Rider interface with the notification bell; Admin work is deferred. Dedicated shells replace shared workspace navigation on `/track`, `/track/result` and Rider routes; `/` redirects to `/track`. Staff auth pages have a standalone form. Verified on the rebuilt local production-mode app: lint, strict typecheck, 27 unit tests, production build and route smoke all passed; all three browser tests passed. Browser checks cover absence of cross-workspace links, 360px public layout/invalid code, Rider-only navigation, My Deliveries parcel filter, bell access, notification date/code filters and mark-read, contact copy, unreachable/retry, private photo delivery and reassignment/isolation. The HTTP regression suite passed, including exact receiving-option/instruction-only notification messages, no-op deduplication, authorization and concurrent writes. Existing Admin page behavior was preserved for the later pass.

| Requirement | Implementation references | Actual evidence |
| --- | --- | --- |
| CUS-01 | `src/server/security.ts`, `services/operations.ts`, tracking API/UI | HTTP valid/invalid code, minimal DTO, parcel session, tampered token and latest committed statuses passed. |
| CUS-02 | Preference schema/service, transaction notifications, tracking UI | HTTP material instruction/option update, no-op deduplication, wrong body scope rejection, stale version, second scope isolation and Delivered lock passed. |
| DRV-01 | Assignment/result services, image decoder, private store and authorized proof stream | HTTP owner denial, unreachable/replay, reassignment denial, mandatory/corrupt-photo validation, successful delivery and persisted private photo passed. Format/size/metadata checks covered by unit tests. Browser delivery and former-Rider evidence denial passed. |
| DRV-02 | Notification transaction helper, API, notification center/bell | HTTP persisted correct-Rider notification, scheduled-date/code filters, unread decrement and read-ownership denial passed. Browser notification/preference visibility passed. Outbox is separate from in-app notifications. |
| ADM-01 | Rider service/UI, Better Auth, bootstrap/seed | HTTP create/provision, forced password change, blocked deactivation, successful inactive-account revocation and role denial passed. All three vehicle types are validated. |
| ADM-02 | Parcel schema/service/UI, crypto helpers, persistent idempotency | HTTP COD validation, unique codes, encrypted admin redisplay, tracking relationship, same-key replay and different-payload conflict passed. Concurrent same-key create passed. |
| ADM-03 | Assignment service/UI, calendar helper, DB constraints/history | HTTP date calculation, correct owner/detail, explicit reassignment/history, same-key concurrent replay and competing reschedule/reassignment passed. |
| Security/consistency | Independent API guards, scoped DTOs, versioned serializable transactions, DB constraints | HTTP CSRF, second scope, role/ownership, stale writes, tampered session, revoked account, immutable attempts and Rider/attempt relationship checks passed. |
| Communication | `workers/outbox.ts`, `tests/integration/outbox.ts` | PostgreSQL-backed simulated retry, concurrent claims, lease recovery, exhausted failures and disabled mode passed. No real provider tested or SMS sent. |
| Storage/reliability | Private object adapter, staging cleanup, proof authorization | Real local files, DB attachment, restart persistence and staged cleanup passed. Unavailable S3 path returned 503 without recording delivery. MinIO integration remains unverified. |

## Commands actually executed

Environment: Windows, system Node 22.11/npm 10.9; project-local Node 24.22 used for compatible checks. PostgreSQL 18.4 binaries are from the `@embedded-postgres/windows-x64` distribution. Local-only database is bound to loopback. No credentials or private assets are committed.

| Command/scenario | Result |
| --- | --- |
| `npm ci` via `npm.cmd` | Initial sandbox cache access failure, then Prisma rejected system Node. Clean install under project-local Node 24 completed; Prisma client generated. |
| `prisma validate` | Passed for the extended auth schema. |
| `prisma migrate deploy` | Initial and auth migrations applied to fresh PostgreSQL; evidence constraints migration applied subsequently. |
| Development seed | Passed; local admin, five provisioned Riders, unassigned/assigned/unreachable/preferences/delivered fixtures and private synthetic proof. |
| Existing `vitest run` | Passed 13 starter unit tests. |
| Expanded `vitest run` | Passed 27 tests in two files, including crypto tamper checks, image decoding/metadata/size/format and operational validation. |
| `npm run typecheck` | Passed after final clean install; Prisma generation, Next route type generation and strict TypeScript completed. |
| `npm run lint` | Passed after final clean install with no errors or warnings. |
| `tsx tests/integration/journeys.ts`, `EXPECT_STORAGE=true` | Passed all printed scenario groups including full photo delivery and expanded concurrent idempotency/assignment/security checks. |
| Final HTTP run against restarted production-mode app | Passed, including notification filters/unread/read ownership. The helper honored the production login limiter's retry interval; no rate limit was weakened. Final strict TypeScript and test-file ESLint also passed. |
| Same HTTP journey with unavailable storage | Passed failure variant: valid photo returned 503 and parcel remained undelivered. This was run before local fallback was enabled. |
| `tsx tests/integration/outbox.ts` | Passed retry, concurrent claim, stale lease recovery, exhausted failure, disabled mode; simulated transports only. |
| Browser journeys | Passed two Chromium journeys against the production-mode app: end-to-end Admin/customer/Rider delivery and reassignment/former-Rider proof denial/two tracking scopes. Tests reuse successful sessions in memory rather than weakening production login limits. |
| MinIO download attempts | Blocked: official dl.min.io and dl.minio.io hosts failed to connect/timed out. Docker unavailable. |
| `npm audit --omit=dev --json` | Zero production dependency advisories on recorded run. Full install reported five high advisories in development dependencies; no force/breaking upgrade performed. |

## Final verification checkpoint

Final `npm ci` under Node 24 passed with Prisma postinstall generation. The documented `lint`, `typecheck`, `test` (27 tests), `build` and `test:smoke` commands then passed. Build used explicit loopback `LOCAL_PRODUCTION_TEST=true`; no filesystem tracing warnings remain, and runtime private data/environment files are excluded from tracing. Production smoke passed public routes, five protected redirects, liveness/readiness and unauthenticated API denial. Two browser journeys passed. Cleanup rehearsal passed expiration/recent-stage/attached-evidence checks. The app was stopped and the development PostgreSQL server stopped/restarted; parcel states, assignments, delivery attempts, notifications and private proof checksums matched the recorded baseline afterward. The rebuilt app was started again on localhost for handoff.

Owner revised the benchmark to 100 synthetic parcels. `scripts/performance.ts --seed` passed on the local production-mode app with Node 24.22/Windows/PostgreSQL/private filesystem storage: exactly 100 benchmark parcels, 115 total including existing fixtures; 20 concurrent readers, 100 measured requests per endpoint after warmup. Tracking p95 236 ms (max 365 ms); assignment list p95 392 ms (max 406 ms). PostgreSQL used the unique tracking lookup index. No 10,000-parcel capacity claim is made.

Measurement hardware: Intel Core i7-1280P, 20 logical CPUs, 16 GiB RAM. All requests were loopback and excluded image-upload transfer time.

Later browser runs add a small number of acceptance parcels without changing the 100 benchmark fixtures. The counts above describe the measurement dataset, not a destructive cap on existing records.

## Release limitations

Private S3/MinIO integration, hosted HTTPS/proxy configuration and backup/restore rehearsal remain unverified. Local filesystem proof and loopback production-build tests do not establish those properties. Real SMS is disabled; only the redacted local simulator exists. Production decisions and remaining infrastructure are documented in DECISIONS.md and OPERATIONS.md.

Navigation follow-up, 2026-10-22: rebuilt local application passed all 4 Chromium workflows (15.2s). Added an assertion that Admin navigation has exactly three links and no Customer/Rider/login links. Existing assertions verify Rider-only navigation on list, notification and detail pages, Customer-only tracking, and Admin-session isolation at the Rider URL. Lint, typecheck and production build passed.
