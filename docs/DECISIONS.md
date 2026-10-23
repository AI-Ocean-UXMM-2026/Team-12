# Decision register

## Current hosting override (2026-10-23)

Owner requested: fully prepare and deploy on Vercel, use Vercel-managed infrastructure, push GitHub changes, remove GitHub Actions and use built-in repository importing/CI/CD. This supersedes the Actions deployment decision below. Native Vercel Git deployment is enabled. The hosted database is a dedicated free Neon resource provisioned through the existing Vercel Marketplace integration: Vercel's standalone Postgres product is discontinued. Evidence uses a dedicated PRIVATE Vercel Blob store. Assignment-bound direct upload grants (15 minutes, immutable path, 10 MiB limit) and authenticated finalization preserve image decoding, resource authorization and transactional idempotency. Raw uploads expire after 24 hours; a daily authenticated Cron removes expired raw and unattached staged proof. The original requirements remain unchanged. Preview branches require separate isolated infrastructure and configuration. Initial Admin access is generated privately, never seeded from local accounts.

Status: initial defaults copied from the implementation plan. These are proposed reversible implementation decisions; no additional owner approvals are implied. Next.js is the confirmed framework. Resolve each decision through implementation and record any owner changes below.

## Initial defaults


These rules resolve PRD gaps for implementation. Record each in `docs/DECISIONS.md` and highlight them in the final handoff.

| Topic | PRD ambiguity | Implementation default |
| --- | --- | --- |
| Expected delivery date | Refers to Assign Date plus three days, but explicitly proposes Delivery Date plus three calendar days | Use scheduled `deliveryDate + 3 calendar days`. Keep the calculation in one tested function so the base can be changed easily. Never use a 72-hour timestamp calculation. |
| Rider result labels | A table uses Delivered; other text uses Delivered Home | Canonical result `DELIVERED_HOME`, displayed as “Delivered Home.” Normalize “Delivered” to that result only where necessary for legacy input. Customer label remains “Delivered.” |
| Unreachable result | Described as unsuccessful, without explicit customer status mapping | `CUSTOMER_UNREACHABLE` maps to customer status `DELAY`. A failed attempt remains retryable. |
| Overdue parcels | Delay is defined but no automatic trigger is specified | Do not automatically mark parcels delayed based on dates. Show expected date and derive Delay from an unreachable result. Keep automatic overdue processing outside this version. |
| SMS | Scope excludes automated SMS, but ADM-02 explicitly says send tracking code via SMS | Build an SMS provider interface plus transactional outbox and a local log adapter. Real sending is disabled by default and needs an owner-approved provider, credentials and explicit enablement. Core acceptance includes visible/copyable tracking codes; report real SMS as pending if not enabled. |
| Photo mandatory or optional | Says update status by uploading a photo, but also says photo where applicable | Require exactly one JPEG/PNG for successful delivery results. Allow zero or one for Customer Unreachable. Each submission accepts at most one photo, maximum 10 MiB. |
| Customer access | No customer login, but tracking and preference writes must be protected | Treat high-entropy tracking code as a bearer capability. Exchange it for a short-lived parcel-scoped server session; no account registration. |
| Preference eligibility | “Eligible” parcels are not defined | Allow changes while Processing Delivery, On the Way or Delay. Reject after Delivered. |
| Instruction notifications | Some text mentions receiving-place changes only; other text includes instructions | Notify on a material change to either option or instructions. A no-op save generates no event. |
| Assignment notifications | Overview includes administrator assignment changes; detailed trigger table only lists customer changes | Notify a Rider on new assignment and schedule changes. On reassignment, notify previous Rider of removal without exposing current parcel details, and notify new Rider of assignment. |
| Unassigned preference change | No assigned recipient for notification | Save preference and audit event. Do not invent a notification recipient. The next assigned Rider sees the latest values. |
| Assignment multiplicity | Reassignment and history are unspecified | At most one current assignment per parcel. Retain previous assignments and attempts as immutable history. No silent overwrites. |
| Rider deactivation | Deactivation exists but effects are undefined | Block deactivation while current undelivered assignments exist. Require explicit reassignment first. Deactivation revokes login and prevents new assignments. |
| Currency | No currency or decimal convention specified | One configured currency, default MMK based on deployment context. Use decimal database values and string serialization; allow configured scale, default two decimal places. No exchange conversion. Confirm currency before production. |
| Dates and language | Not specified | English UI, configurable business timezone default `Asia/Yangon`. Store instants in UTC and operational dates as SQL DATE. |
| Payment amounts | Order amount required for COD only | COD requires a positive order amount. Prepaid order amount is optional and nonnegative. Delivery fee is required and nonnegative. Do not invent a COD total or payment settlement rule. |
| Vehicle types | Required table lists Delivery Van, Car, Bicycle | Support exactly those values. Vehicle Number remains optional, including for Bicycle. |
| Customer identity in notifications | Template allows customer or business name | Use recipient customer name, fall back to sender business/person name if legacy data lacks recipient name. |
| Admin editing | Parcel editing and deletion behavior not defined | Create, list and view parcels; do not implement destructive deletion or general post-dispatch parcel edits. Rider editing and assignment management are supported explicitly. |
| Operational targets | Performance, retention and availability targets are undefined | Use measurable engineering targets in section 12 as provisional targets; do not invent a retention/deletion policy or availability commitment. |


## Stack resolution

Codex must record the actual selected Next.js, React, Node.js, ORM, authentication, UI, testing and package-manager versions and rationale after inspecting the environment and official compatibility documentation. No versions have been resolved yet.

## Before production

Confirm the expected-date formula, successful-delivery photo requirement, currency/scale, hosting and storage, authentication setup/recovery mechanism, retention periods and operational targets. SMS is not required under the current owner instruction recorded below. These items do not prevent local implementation using the defaults above.

## Changes and approvals

| Date | Topic | Previous default | New decision | Evidence or owner instruction | Affected code/tests |
| --- | --- | --- | --- | --- | --- |
| — | Initial specification package | — | Defaults above | Marked assumptions in implementation plan | Implementation pending |


## Resolved scaffold dependencies

Installed versions are locked in `package-lock.json`.

| Dependency | Version |
| --- | --- |
| `next` | 16.4.2 |
| `react` | 19.3.1 |
| `react-dom` | 19.3.1 |
| `typescript` | 5.9.3 |
| `tailwindcss` | 4.3.3 |
| `prisma` | 7.10.1 |
| `@prisma/client` | 7.10.1 |
| `zod` | 4.6.7 |
| `vitest` | 4.1.12 |
| `@playwright/test` | 1.64.1 |
| `eslint` | 9.39.5 |

Prisma 7.10.1 was selected deliberately instead of the registry's `latest` prerelease (8.0.0-rc). The installed Next.js/React pair passed the build. ESLint 9.39.5 is pinned for the declared peer compatibility of the Next.js config's React/import/accessibility plugins; npm reports that this ESLint line is deprecated. Reassess a coordinated lint-tooling upgrade during continued development rather than forcing incompatible peers. This does not block starter lint/build checks.

Identity is a schema foundation only. Rider.userId is nullable to allow staging synthetic Rider profiles without fake login credentials. Operational assignment services must require an active provisioned user and should tighten this model once the maintained auth library is integrated. No authentication or user session is faked in this scaffold.

Official implementation references consulted: [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [Prisma 7 configuration and adapters](https://docs.prisma.io/docs/guides/upgrade-prisma-orm/v7), and [PostgreSQL connector](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql).

## Implementation resolutions on 2026-10-22

- Rider navigation/account clarification: Rider routes must never display the Admin workspace. Opening a Rider URL with an Admin session now shows a Rider-account sign-in prompt instead of redirecting to Admin navigation. A Rider's delivery list is always scoped to the authenticated Rider and selected date (defaulting to the business date); browser-supplied Rider IDs cannot broaden it. My Deliveries, the notification bell and sign-out remain the only Rider navigation controls.

- Current owner interface scope: customer pages contain only CUS-01/CUS-02 tracking and receiving preferences; Rider pages contain My Deliveries with the DRV-02 bell/notification center and delivery details/results. Root `/` redirects to customer `/track`. Customer pages have no staff/workspace links or sign-out; Rider navigation contains My Deliveries, the bell and sign-out. Shared staff sign-in/setup pages have no operational navigation. Existing Admin pages are preserved for a later owner-directed pass. The previous parcel-code/no-SMS owner decision remains in force despite the pasted PRD's generic “tracking code” wording. Successful Rider results display “Delivered” while retaining the canonical `DELIVERED_HOME` database value.

- Current owner override: “there's no SMS needed, i just wanna track with parcel code for both customers and admin.” Customers and Admins now use the same parcel code at `/track`; Admins can also search the authorized parcel list by that code. This supersedes the separate private tracking-token lookup and SMS requirement/defaults above. Parcel-code possession grants the existing minimal customer view and receiving-preference capability through a short-lived scoped session. Operational details and proof remain protected by Admin/Rider authorization. Parcel creation no longer queues SMS, and the UI no longer displays a separate tracking code or SMS setup status. Legacy tracking-token columns and standalone outbox tools are retained for database/history compatibility, not as required tracking steps. Source PRD and plan are preserved unchanged.

- Owner override: “just do 100 parcels” replaces the plan's provisional 10,000-parcel local benchmark dataset with 100 synthetic benchmark parcels. Retain 20 concurrent readers. The interrupted larger command created zero benchmark records; the revised run created exactly 100. Existing acceptance fixtures remain, giving 115 total records at measurement. This does not claim capacity at 10,000 parcels.

- Authentication: Better Auth 1.7.12, using its Prisma adapter, database sessions, library scrypt password hashing and Next cookie integration. Public signup is disabled. Admin provisioning issues a private random initial password; setup is forced before domain access, and reset/deactivation revoke database sessions. Roles/activity are always re-read server-side. References: [Better Auth installation](https://better-auth.com/docs/installation), [database schema](https://better-auth.com/docs/concepts/database), [email/password](https://better-auth.com/docs/authentication/email-password), and [Next.js integration](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/integrations/next.mdx). This resolves the starter's identity-only warning; nullable staged Rider profiles still require an active provisioned User before assignment.
- Runtime: preserved locked Next.js 16.4.2, React 19.3.1 and Prisma 7.10.1 rather than recreating the app. System Windows Node 22.11 was incompatible with Prisma; a project-local Node 24.22 runtime was used. Recommended `.nvmrc` remains Node 24. One npm lockfile remains authoritative. The downloaded runtime and PostgreSQL binaries are ignored local tools, not application dependencies.
- Image handling: sharp 0.35.5 decodes JPEG/PNG with a 40-million-pixel ceiling and re-encodes JPEG without EXIF. Output MIME reflects the stored encoding. The input limit remains 10 MiB; multipart stream limit is 11 MiB. Staging cleanup waits 24 hours and claims unattached records before removing objects; this is cleanup of failed uploads, not an operational retention policy.
- Local storage deviation: Docker is absent and both official MinIO binary hosts were unreachable. A real private durable filesystem object adapter was added as an explicitly selected local fallback outside `public`. It uses the same authenticated evidence stream and staging lifecycle as S3. It is development-only except explicit loopback production-build testing. MinIO/S3 integration is still an unverified external requirement, not claimed complete or replaced as the production recommendation.
- PostgreSQL: real local PostgreSQL 18.4 binaries were used for Windows verification, while the existing Compose PostgreSQL 17 configuration is preserved. The local portable cluster's loopback trust authentication is development-only. No production data was reset.
- Concurrency/idempotency: serializable transactions, parcel/Rider row locks, PostgreSQL advisory locks, unique constraints and bounded retries protect writes. Prisma raw-query wrapped serialization failures require inspecting driver conflict metadata as well as P2034. Idempotency records promise at least a 24-hour replay horizon and currently remain stored beyond expiry; no automatic record purge is enabled.
- Money: the actual schema and validator support two decimal places. `MONEY_DECIMAL_PLACES` values other than 2 are rejected rather than silently rounded; another scale needs a coordinated schema/validation migration. Default MMK remains provisional.
- Rate limiting uses shared PostgreSQL state, not an in-memory production map. Forwarded IPs are used only with explicit trusted-proxy configuration. In local mode a shared loopback bucket applies.
- SMS: local outbox and simulator are implemented and labeled; no real provider adapter or credential is invented. Production refuses enabled SMS until an approved integration exists. SENT local events explicitly record that no real SMS was sent.
- `next dev` appended its own framework instruction block to AGENTS.md; the original owner instructions were preserved. Installed Next.js route/cookie/instrumentation guides were consulted for API integration.

Navigation follow-up, 2026-10-22: removed the legacy cross-role menu entirely. AppShell is Admin-only with a server-side role check; it exposes Riders, Parcels and Assignments only. RiderShell remains My Deliveries, notification bell and Sign out, following the owner's restricted Rider navigation requirement.

2026-10-22 owner update: authorize Vercel deployment via GitHub Actions, superseding the previous no-public-deployment restriction for this request. Production deploy follows main-branch checks, never seeds local accounts, and requires independently configured hosted PostgreSQL/S3 and production secrets. Keep SMS disabled. Vercel size limitations are recorded without reducing the 10 MB photo requirement.
