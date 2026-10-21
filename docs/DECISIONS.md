# Decision register

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

Confirm the expected-date formula, successful-delivery photo requirement, currency/scale, hosting and storage, authentication setup/recovery mechanism, real SMS scope/provider, retention periods and operational targets. These items do not prevent local implementation using the defaults above.

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
