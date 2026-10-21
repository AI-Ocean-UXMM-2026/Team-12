# Acceptance and verification record

The complete scenario definitions are in section 12 of `IMPLEMENTATION_PLAN.md`. This file records actual implementation and evidence. Product acceptance remains unverified; scaffold checks are recorded below.

| Requirement | Required evidence | Code/test references | Result |
| --- | --- | --- | --- |
| CUS-01 | Correct scoped parcel, invalid-code response, latest status, private DTO | Pending | Not run |
| CUS-02 | Three receiving options, instructions, parcel isolation, notification, delivered lock | Pending | Not run |
| DRV-01 | Date/code filters, fields, contact copy, results/photos, owner checks | Pending | Not run |
| DRV-02 | Bell/read state, persisted notifications, filters, correct authorized links | Pending | Not run |
| ADM-01 | Create/view/edit/deactivate, required fields, vehicles, account revocation | Pending | Not run |
| ADM-02 | Required parcel fields, COD validation, unique codes and tracking, communication state | Pending | Not run |
| ADM-03 | Assign/reschedule/reassign, expected date, history, status and authorized proof | Pending | Not run |
| Security | Role and parcel isolation, CSRF, rate limits, expired/revoked sessions, private photos | Pending | Not run |
| Consistency | Idempotency, stale writes, assignment/delivery/preference/deactivation races | Pending | Not run |
| Uploads | Valid formats, size/count, corrupt/forged images, relationship checks, cleanup | Pending | Not run |
| Reliability | Restart persistence, outbox retries and failed submission recovery | Pending | Not run |
| Usability | Mobile layouts, keyboard access, labels, loading/empty/error states | Pending | Not run |

## End to end journeys

- [ ] Admin creates Rider/access and COD parcel, retrieves tracking code and assigns delivery.
- [ ] Customer tracks and changes receiving preference/instruction; correct Rider sees notification and latest values.
- [ ] Rider submits unreachable then retries with valid delivery photo; customer transitions Delay to Delivered; admin accesses proof.
- [ ] Reassignment transfers access; previous Rider cannot read/submit; new Rider sees correct dates/preferences.
- [ ] Second Rider and second tracking scope cannot read/change first parcel by manipulating IDs.

## Check execution log

| Date | Command or manual scenario | Environment | Result and evidence |
| --- | --- | --- | --- |
| — | Full PRD application checks | Product implementation pending | Not run |

Codex must append exact lint, typecheck, unit/integration/browser test and production-build commands and results. Also record fresh migration/seed/restart checks, mobile/accessibility review and performance measurements. A skipped or blocked check is not a pass.

## Release limitations

Record missing credentials, unverified external integrations, unresolved production decisions and operational gaps. Never mark real SMS verified using the local adapter.


## Scaffold verification on 2026-10-21

Environment: Node.js 24.19.0, npm 11.9.0, Linux. These results validate the starter only, not the complete PRD.

| Check | Result |
| --- | --- |
| `npm ci` | Passed; clean install and Prisma postinstall generation completed |
| `npm run db:validate` / `npx prisma validate` | Passed; Prisma schema valid |
| `npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script` | Passed; base SQL generated, then domain constraints added |
| `npm run lint` | Passed without warnings after configuration cleanup |
| `npm run typecheck` | Passed |
| `npm test` | Passed, 13 unit tests |
| `npm run build` | Passed; all starter routes compiled |
| `npm run test:smoke` | Passed; eight production HTML routes and liveness/no-store check |
| `npx playwright test --list` | Passed; one Chromium test discovered |
| `npx playwright install chromium` | Blocked; downloaded browser archive was invalid/truncated in this environment |
| Playwright browser execution | Not run; browser unavailable |
| Docker services, migration apply, database seed and MinIO integration | Not run; Docker/PostgreSQL executables unavailable in this environment |
| Full PRD authorization, concurrency and acceptance journeys | Not implemented or tested yet |

The SQL migration is supplied but has not been applied to a live PostgreSQL instance here. Codex must verify it, the seed and private storage before marking phase 1 complete. CI includes Playwright installation/execution for an environment with working browser downloads.
