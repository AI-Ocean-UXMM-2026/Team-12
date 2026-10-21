# Parcel Delivery Management and Tracking System
## Autonomous Next.js implementation plan

Source: `Final - Product Requirements Document-Parcel Delivery Management & Tracking System.docx`, supplied by the product owner. This plan translates that PRD into executable engineering instructions. It includes explicitly marked implementation defaults where the PRD is incomplete or contradictory. The only technology choice explicitly confirmed by the owner is Next.js; the remaining stack is recommended below.

## 1. Instructions for Codex

You are implementing a working parcel delivery application, including a public customer tracking experience, an authenticated Rider workspace, and an authenticated administrator panel. Deliver the database, server logic, authorization, private photo storage, usable screens, tests, setup instructions, and deployment guidance. Static screens or browser-only mock persistence do not satisfy the task.

Read this entire file and the PRD before coding. If the PRD is supplied as DOCX, extract paragraphs and tables in document order; tables contain required fields and business rules. Inspect existing repository instructions, dependencies, migrations, and application structure first. Preserve compatible existing work and avoid replacing established conventions without a concrete reason.

Work through the phases in section 13 in order. Within each phase, implement a complete vertical slice, run relevant checks, fix failures, and update progress before continuing. Do not stop after producing a scaffold or asking whether to proceed. Continue autonomously through all phases possible with local resources. Missing external credentials must not block local core functionality: implement the real adapter interface, a documented local substitute, and exact production configuration steps. Never claim an integration was tested when credentials were absent.

Create and maintain these repository files:

- `docs/IMPLEMENTATION_PLAN.md`: this plan.
- `docs/DECISIONS.md`: defaults adopted, rationale, consequences, and owner-confirmation items.
- `docs/PROGRESS.md`: checklist by phase and requirement ID, completed checks, remaining tasks and blockers.
- `docs/ACCEPTANCE.md`: requirement-to-test traceability and manual verification steps.
- `README.md`: local setup, demo access, commands, storage, background worker, and deployment.
- `.env.example`: variable names and safe placeholder values, with no secrets.

Treat this document as the initial implementation baseline. When an owner later resolves a default, update decisions and affected tests. Do not describe an assumed rule as explicitly approved. Ask only when a missing decision would cause irreversible harm or cannot be resolved safely through a reversible default. Do not deploy publicly or send real SMS merely to demonstrate completion.

## 2. Product boundary and requirement map

| PRD ID | Required capability | Primary implementation |
| --- | --- | --- |
| CUS-01 | Track a parcel by its tracking code and display current status | Public tracking form and restricted tracking response |
| CUS-02 | Change receiving place and save instructions for one parcel | Tracking-session-scoped preference form and Rider notification |
| DRV-01 | View assigned daily parcels, filter, open details, copy contact, upload photo and submit result | Rider assignments and transactional result submission |
| DRV-02 | Receive and filter notifications and open the corresponding parcel | Bell, unread count, notification list and detail navigation |
| ADM-01 | Create, view, edit and deactivate Riders | Rider administration and account provisioning |
| ADM-02 | Create and view parcels and generate unique parcel and tracking codes | Parcel administration, code generation and communication adapter |
| ADM-03 | Assign parcels to Riders with dates, status and photo access | Assignment administration and expected date calculation |
| Cross-functional | Enforce security, consistency, privacy, reliability and clear validation | Server policies, transactions, tests, error handling and operations |

Exclude customer registration, payments processing, payment collection reconciliation, live GPS, maps/route optimization, automatic route planning, returns/refunds, signatures, analytics dashboards and email/messaging integrations. Prepaid/COD and monetary amounts are stored parcel information, not a payment gateway. A Rider's “daily route” is a filtered assignment list, not an optimized itinerary.

Do not add unrelated features. A simple operational home page with navigation is sufficient; no analytics dashboard is required.

## 3. Decisions and reversible defaults

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

## 4. Recommended architecture

Use a single Next.js application with the App Router and TypeScript in strict mode. At implementation time, inspect the repository and consult official documentation for compatible stable releases. Use the current stable supported Next.js/React pair rather than canary packages, pin versions in the lockfile, and record the resolved versions. This plan intentionally does not prescribe potentially stale version numbers.

Recommended dependencies and infrastructure:

- PostgreSQL and Prisma ORM, with committed SQL migrations.
- Tailwind CSS and accessible component primitives such as shadcn/ui; use semantic HTML and consistent form components.
- Zod for shared request validation. Server validation is authoritative.
- A maintained Next.js-compatible authentication library using secure server sessions and password hashing with Argon2id or a library-supported secure equivalent. Auth.js is a suitable default if supported by the resolved dependency versions. Avoid custom cryptographic/session protocols.
- Private S3-compatible object storage. Use MinIO locally and a configurable provider in production.
- Vitest for domain and integration tests; Playwright for browser acceptance tests.
- A small database-backed outbox worker for optional SMS. Start it separately from Next.js; never rely on in-process timers in a serverless request.
- Docker Compose for local PostgreSQL and MinIO. The app may run on the host using the repository's package manager.

Use Server Components for initial authenticated reads and Route Handlers for browser writes, public tracking exchange, uploads, polling and file access. Client Components handle forms, dialogs, copying and refresh behavior. Put domain rules in server-only services; routes must not duplicate business rules. All mutations must authenticate, authorize, validate and run the relevant transaction on the server.

Suggested organization:

```text
src/
  app/
    (public)/track/
    (auth)/login/
    (admin)/admin/{riders,parcels,assignments}/
    (rider)/rider/{assignments,notifications}/
    api/v1/
  components/{ui,forms,tables}/
  lib/{auth,db,validation,storage,dates,money,security}/
  server/{services,policies,repositories,notifications,sms}/
  domain/{enums,transitions,errors}/
prisma/{schema.prisma,migrations,seed.ts}
workers/outbox.ts
scripts/
tests/{unit,integration,e2e}/
docs/
```

Adapt names to repository conventions. Prefer a straightforward monolith; do not introduce microservices, a mobile app, GraphQL, a message broker or a separate API server.

## 5. Data model and invariants

Use UUID/CUID internal identifiers that are distinct from human parcel codes and secret tracking codes. Every mutable operational record has timestamps and, where relevant, an integer version for optimistic concurrency. Add indexes based on actual list queries.

### Identity

`User`: id, login identifier, password hash or auth-provider identity, role (`ADMIN`, `RIDER`), active flag, session-revocation/version value and timestamps. Store auth-library session/account records as required. Do not offer public registration.

`Rider`: id, unique userId, name, contactNumber, vehicleType (`DELIVERY_VAN`, `CAR`, `BICYCLE`), optional vehicleNumber, active flag, timestamps and version. Rider and user activity changes must remain consistent in one transaction. Phone numbers are strings; preserve leading zeros and plus signs. Apply reasonable formatting validation without assuming all numbers belong to one country. Do not make phone number globally unique unless confirmed.

Admin creates a Rider profile and provisions access. Default local workflow: generate a one-time setup credential, display it once only to the creating administrator, force password change at first login, and never send it automatically. Prefer the selected auth library's supported setup/reset mechanism. Admin can revoke sessions and issue a new setup credential; no plaintext password storage. Rate-limit credential attempts. Seeded development credentials must be isolated from production and documented.

### Parcels

`Parcel`:

- id; unique parcelCode; unique trackingCodeHash; encrypted tracking code plus nonce/key version if authorized admin redisplay is required; no plaintext tracking code in logs.
- senderName; receivedDate; receivedPerson (required text); createdByAdminId for authenticated audit attribution.
- customerName; customerContactNumber; township; address; optional deliveryNote.
- paymentType (`PREPAID`, `COD`); optional orderAmount Decimal; deliveryFee Decimal; currency.
- receivingOption (`HOME`, `NEIGHBOUR`, `DOOR`), default HOME; optional deliveryInstruction.
- customerStatus (`PROCESSING_DELIVERY`, `ON_THE_WAY`, `DELIVERED`, `DELAY`), default PROCESSING_DELIVERY.
- nullable currentAssignmentId; nullable deliveredAt; version; createdAt; updatedAt.

Use cryptographically secure random tracking tokens with at least 128 bits of entropy. Human parcel codes may use a readable prefix plus unique random suffix or a concurrency-safe sequence. Both have database unique constraints and bounded collision retries. Tracking tokens must not be derived from parcel codes or sequential IDs. Define case normalization consistently; never remove meaningful characters in a way that creates alias collisions.

Admin must be able to view/copy the tracking code after creation. Support this with authenticated encryption at rest and a separate environment key while using a hash/HMAC for lookup. Keep encryption keys outside the database and document key backup/rotation. Public responses never return tracking hashes or ciphertext.

### Assignments and delivery attempts

`Assignment`: id, parcelId, riderId, assignDate DATE, deliveryDate DATE, expectedDeliveryDate DATE, lifecycle (`ACTIVE`, `REASSIGNED`, `COMPLETED`), latestResult nullable, assignedByAdminId, endedAt nullable, version and timestamps.

Enforce at most one ACTIVE assignment per parcel with a PostgreSQL partial unique index in a migration. Ensure Parcel.currentAssignmentId points to an assignment for that same parcel; enforce through a compound reference or explicit transaction invariant backed by tests. Finished parcels may keep their completed assignment as current for history/detail access. No reassignment of a delivered parcel in this version.

`DeliveryAttempt`: id, assignmentId, parcelId, riderId, result (`CUSTOMER_UNREACHABLE`, `DELIVERED_HOME`, `DELIVERED_TO_NEIGHBOUR`, `LEFT_AT_DOOR`), submittedAt, optional photoAssetId, idempotencyKey and actor attribution. Append-only. A retry after an unreachable attempt creates a new attempt. Associate each photo with one attempt and the exact parcel/assignment.

`PhotoAsset`: id, random storageKey, detectedMimeType, byteSize, checksum, uploaderId, parcelId, assignmentId, createdAt and lifecycle (`STAGED`, `ATTACHED`, `DELETE_PENDING`). Do not expose storage keys or public object URLs. Historical photos are not overwritten by retries.

### Notifications and audit

`RiderNotification`: id, riderId, optional parcelId and assignmentId, type, display payload snapshot (delivery date, parcel code, recipient name/contact, receiving option/instruction where applicable), createdAt, readAt nullable. Scope queries by authenticated Rider. Snapshots must remain private to the intended recipient and must not bypass current authorization for detail links.

`AuditEvent`: id, actor type/id or parcel-scoped customer actor, parcelId optional, assignmentId optional, eventType, sanitized change metadata, requestId, createdAt. Never store raw tracking tokens, credentials or photo bytes in audit metadata.

`OutboxEvent`: id, eventType, related entity IDs, protected/minimized payload, deduplication key, state, attemptCount, nextAttemptAt, lockedAt, lastError and sentAt. Used for external SMS; in-app notifications are persisted directly with the domain transaction. Protect any recipient/token content in the outbox; redact worker logs.

Indexes: unique parcelCode and trackingCodeHash; Rider active/name/contact; assignments on riderId/deliveryDate/lifecycle and parcelId; notifications on riderId/createdAt and riderId/readAt; attempts on assignmentId/submittedAt; outbox on state/nextAttemptAt. Add explicit foreign-key deletion policies; avoid cascading deletion of operational history.

## 6. State transitions and transactional behavior

| Action | Required precondition | Atomic business result |
| --- | --- | --- |
| Admin creates parcel | Valid admin, valid fields | Parcel and codes created, Processing Delivery, audit event, optional tracking SMS outbox event |
| Admin assigns parcel | Undelivered parcel; active Rider and user; no current active assignment unless explicit reassign | Active assignment, current pointer and On the Way status; expected date; audit and Rider notification |
| Admin reschedules | Current undelivered assignment, matching version | Updated dates/expected date and notification; preserve previous date values in audit |
| Admin reassigns | Current undelivered parcel, active target Rider, matching version | End prior assignment, create new active assignment, move current pointer, On the Way status, audit and removal/new notifications |
| Customer saves preferences | Valid scoped tracking session; parcel not Delivered; matching version | Update only this parcel, audit and notification to current assigned Rider if values changed |
| Rider submits unreachable | Active current assignment belongs to Rider; matching version | Append attempt, set latestResult and Delay, retain assignment ACTIVE, attach optional photo, audit |
| Rider submits successful delivery | Same ownership check; valid one photo | Append attempt, attach photo, set Delivered/deliveredAt, complete assignment and audit |

A completed parcel is terminal. Reject customer edits, second delivery submissions, rescheduling and reassignment after delivery. Replaying the same successful idempotency key returns the original success; it must not create a new attempt or conflict merely because the first request completed the parcel. Reusing a key with a different payload returns a conflict.

Reassignment is explicit and must not happen as an incidental list edit. Reset customer status to On the Way when dispatching a new assignment after Delay, but retain previous unsuccessful attempts and history.

Enforce races on the database, not just through disabled buttons. Use transactions with row locks or conditional version updates, partial uniqueness and bounded retry handling for serialization conflicts. Assignment, Rider deactivation, preference changes and delivery completion must serialize against competing operations on the affected records. In particular, a preference write racing with reassignment must notify the correct Rider at commit, and a former Rider's late submission must fail.

Photo storage and PostgreSQL cannot share one transaction. Stage and validate the private object first, then atomically attach its metadata with the delivery attempt. If the transaction fails, mark/schedule object cleanup. A worker or maintenance command removes unreferenced staged uploads after a configurable grace period. Never delete an attached proof photo as part of staging cleanup.

## 7. Screens and exact field coverage

### Public customer experience

`/track`: tracking-code input, Track button, submitting state and a generic invalid/unavailable-code error. Exchange code in a POST body, never put it in route URLs, query parameters, analytics or referrers.

After success, use `/track/result` backed by a secure short-lived HttpOnly parcel-scoped session. Show parcel code, latest customer-facing status, scheduled/expected delivery date where assigned, selected receiving option and saved instructions. Show only minimal recipient context, such as masked name if needed; do not expose phone, address, money, Rider identity or proof photos publicly by default.

Allow Receive at Home, Leave with Neighbour, Leave at Door; instruction textbox and Save button. After saving, show persisted values and a confirmation. Delivered parcels show values read-only. Missing/expired session returns to tracking entry. Provide a clear “Track another parcel” action that replaces/clears the previous scope.

### Authentication

`/login`: admin/Rider login, generic credential errors and session expiry handling. Redirect by role. Protected layouts improve navigation, but every data endpoint independently authorizes. First-time setup/password change has an authenticated restricted flow. No customer account UI.

### Admin Rider management

`/admin/riders`: top filters labeled Rider Name and Mobile Number, Search/Reset controls, paginated table with Rider Name, Contact Number, Vehicle Type, Vehicle Number, active state and actions. Seed at least five realistic synthetic rows.

`/admin/riders/new`, `/admin/riders/[id]`, `/admin/riders/[id]/edit`: required name, contact and vehicle type; optional vehicle number; view/edit, account setup/reset and deactivate actions. Block deactivation with an explanation if reassignment is needed. Use exact vehicle options from section 3.

### Admin parcel management

`/admin/parcels`: table with Parcel Code, Customer Name, Customer Contact Number, Payment Type, customer status and latest Rider result as separate labeled fields. Before any result, show “No result yet.” Include parcel-code and customer search plus pagination as usability additions; they must not replace required fields.

`/admin/parcels/new`: From section with system-generated Parcel Code after save, Business/Person Name, Received Date, Received Person. To section with Customer Name, Contact Number, Payment Type, conditional Order Amount, required Delivery Fee, Township, Address and optional Delivery Note. Do not ask admin to manually generate or enter tracking/parcel codes.

`/admin/parcels/[id]`: saved fields, current preference/instructions, statuses, assignment and attempt history, tracking-code view/copy, communication state and an Assign action where eligible. Masking/reveal controls for secret codes are recommended. No unimplemented “send SMS” button.

### Admin assignments

`/admin/assignments`: paginated list with Parcel Code, Assigned Rider, Assign Date, Delivery Date and current status; show latest result separately where present. Add date, Rider and parcel filters.

`/admin/assignments/new`: select eligible parcel and active Rider, Assign Date (business date default), Delivery Date, read-only calculated Expected Delivery Date, Save. Default delivery date must be on or after assign date; reject earlier values under this provisional validation rule.

`/admin/assignments/[id]`: parcel, Rider, dates, expected date, customer status, latest result, customer preference, delivery attempt history and authorized private photo access. Explicit reschedule/reassign actions only for undelivered current assignments. Historical assignment details clearly indicate reassigned/completed state.

### Rider workspace

`/rider/assignments`: default date is today in business timezone. Date and Parcel Code filters. Required columns/cards: Customer Name, Customer Contact Number with copy action, Township, Parcel Code and Status. Use the selected delivery date, not record creation date, for filtering. Completed assignments remain visible for their relevant date; reassigned-away records are excluded from the actionable list.

`/rider/assignments/[id]`: all list fields plus Address Detail, Customer Receive Place, Delivery Instruction, operational delivery note where present, one-photo upload, result dropdown and Submit. Options: Customer Unreachable, Delivered Home, Delivered to Neighbour, Leave at Door. Show file preview/remove control, validation and upload progress. Clearly distinguish customer status from Rider result. Refresh latest preferences before final submission; detect stale versions and require review rather than silently discarding edits.

Successful submit shows saved result and photo. Completed detail is read-only. Clipboard errors produce feedback and allow manual selection.

`/rider/notifications`: bell with unread count in layout, filters Date and Parcel Code; list Date (scheduled delivery date), Parcel Code, Receive Place, Instruction, Customer Name, Customer Contact Number. Also display notification creation time separately so “Date” is not ambiguous. Instruction text must wrap safely. Open links to the correct assignment only when still authorized; removal notifications show a safe unavailable message. Mark read only through an authorized mutation, never through GET.

All views require loading, empty, validation, permission-denied, not-found and retryable error states. Tables paginate on the server. Admin screens work on desktop/tablet; Rider and customer screens must be usable on mobile from 360 px wide. Do not fabricate maps, GPS positions or optimized route order.

## 8. API and service contracts

Use a consistent response shape, for example `{ data, meta? }` for success and `{ error: { code, message, fieldErrors?, requestId } }` for errors. Do not return database error text or stack traces. Use 401 for unauthenticated, 403 for role denial, 404 for inaccessible individual resources when existence should be hidden, 409 for stale/concurrent state, 413 for oversized upload, 415 for unsupported media and 422 for field validation. Public tracking failures should use one indistinguishable invalid-code response.

Suggested contracts; equivalent route names are acceptable if fully documented:

| Method and route | Policy and purpose |
| --- | --- |
| POST `/api/v1/tracking/session` | Rate-limited code exchange; set scoped secure session and return safe tracking DTO |
| GET `/api/v1/tracking` | Scoped customer tracking read with no-store caching |
| PATCH `/api/v1/tracking/preferences` | Scoped parcel only; option, instruction, expected version |
| DELETE `/api/v1/tracking/session` | Clear tracking scope |
| GET/POST `/api/v1/admin/riders` | Admin list/create |
| GET/PATCH `/api/v1/admin/riders/:id` | Admin detail/edit with version |
| POST `/api/v1/admin/riders/:id/deactivate` | Admin, enforce open-assignment rule |
| POST `/api/v1/admin/riders/:id/setup-access` | Admin credential setup/reset and session revocation |
| GET/POST `/api/v1/admin/parcels` | Admin list/create; creation supports idempotency key |
| GET `/api/v1/admin/parcels/:id` | Admin full operational detail; tracking reveal only through authorized server path |
| GET/POST `/api/v1/admin/assignments` | Admin list/create |
| GET/PATCH `/api/v1/admin/assignments/:id` | Admin detail/reschedule with version |
| POST `/api/v1/admin/assignments/:id/reassign` | Admin explicit reassignment with version |
| GET `/api/v1/rider/assignments` | Current user's assignment list; date/parcel code pagination |
| GET `/api/v1/rider/assignments/:id` | Current owner or own completed assignment only |
| POST `/api/v1/rider/assignments/:id/results` | Multipart result/photo, version and idempotency key |
| GET `/api/v1/rider/notifications` | Current Rider only; filters, pagination, unread count |
| PATCH `/api/v1/rider/notifications/:id/read` | Current notification owner only |
| GET `/api/v1/photos/:id` | Admin or authorized owning Rider; short-lived signed URL or authenticated stream |

Do not accept riderId or parcelId from the customer preferences body; derive parcel from the scoped session. Derive Rider identity from authentication, not a browser-supplied field. Validate pagination limits and allowlisted sort/filter fields. Never spread unrestricted request bodies into ORM writes.

Apply idempotency to parcel creation, assignment creation/reassignment, result submission and outbox events. Scope keys by authenticated actor/action, persist request fingerprint and response, and define a documented expiry window. Database uniqueness and transaction rules must protect concurrent duplicate requests. Make no-op preference submissions safe without duplicate notifications.

## 9. Upload security, privacy and freshness

For photo input, enforce one file server-side, JPEG/PNG only, maximum 10 MiB, valid decodable image content and a reasonable pixel-count limit to reject decompression bombs. Check signatures and decoded format; extensions/browser MIME are insufficient. Strip EXIF/location metadata and re-encode safely. Use random object keys, private ACLs and accurate Content-Type. Do not serve uploaded names as executable content. Configure infrastructure request limits to accommodate multipart overhead while preserving the application file limit; avoid a hosting path that cannot accept the specified file size. If direct-to-storage upload is required, use short-lived constrained staging credentials and validate again before attachment.

Only admin and the still-authorized Rider may access proof. A former Rider loses access after reassignment. An owning Rider can access their completed assignment proof. Signed URLs expire quickly; do not persist them in database or notification payloads. Customer tracking cannot fetch proof by guessing an asset ID.

Use HTTPS, secure HttpOnly cookies, sensible SameSite settings, Origin/CSRF protection for mutations and rate limits for login, tracking-code exchange, preference edits and uploads. Production rate limiting must use shared state across app instances; a process-local Map is only a local-development substitute. Never log tracking tokens, passwords, full recipient details or signed photo URLs. Sanitize user text by rendering it as text, not HTML. Set an appropriate referrer policy for tracking pages.

Do not use publicly cached personalized responses. Use explicit no-store/dynamic behavior on tracking, assignments, notifications and photo routes according to the installed Next.js version. After writes, invalidate relevant views and refetch authoritative state. Poll visible tracking/result and Rider notification screens every 15 seconds as a simple MVP freshness strategy; pause in background tabs and refresh on focus. Immediate saved changes should update the current UI without waiting for polling. All role views must agree after the next refresh.

## 10. Notifications and optional SMS

Persist in-app notifications in the same database transaction as the preference or assignment change. Required preference message: “{Customer Name or Business Name} changed receiving option for {Parcel Code}.” For instruction-only changes, use an equivalent instruction-specific message. Include the latest option/instruction snapshot. Never notify unrelated Riders.

Implement unread count, mark-read, date/parcel-code filtering and correct deep links. Define the notification date filter as scheduled delivery date in the business timezone; creation time is separate. Historical snapshots remain visible only to their recipient; current parcel access is rechecked when following a link. Removal notification payloads contain only minimal parcel code/date and no newly changed private details.

For SMS, creation transaction queues one tracking-code communication event if the feature is configured. Worker claims jobs safely across multiple processes, retries transient failures with bounded exponential backoff, records permanent failure, and supports controlled admin retry or a documented operations command. Use provider idempotency where supported and record provider message ID. Exactly-once external delivery cannot be guaranteed without provider support; document this limitation. Local adapter must label messages as simulated and must not log raw tracking secrets in shared production logs. Production-disabled SMS must show “Not sent — SMS not configured,” rather than fake success. Do not send real messages during tests.

## 11. Validation and edge cases

Implement these checks in reusable server schemas/domain services and mirror helpful checks in the UI:

- Required text is trimmed and nonempty. Set documented maximum lengths, e.g. names 120, phone 32, address 1,000 and instructions/notes 2,000 characters; show clear errors. These lengths are technical defaults, not PRD facts.
- Reject invalid enum values, negative amounts, malformed decimal strings, invalid dates and timestamps passed where a date-only value is required.
- COD order amount must be greater than zero. Prepaid amount may be null. Use Decimal/string transport; never calculate monetary values with floating point.
- Assignment dates and expected date are deterministic across UTC midnight, month/year boundaries and business timezone. Default expected date base is delivery date.
- Inactive Riders cannot login, receive new assignments or submit results; revoke existing access server-side promptly.
- Assignment/result/photo relationships must match. A valid photo uploaded for parcel A cannot attach to parcel B.
- Preserve failed-submission form content, support retry and avoid duplicate records after network timeouts.
- Handle an unassigned parcel, no results, no photo, empty instruction, same-value preference save, assignment removed mid-edit, expired customer session and stale tabs explicitly.
- Normalize Neighbor/Neighbour and Leave at Door variants at the domain boundary; use consistent display labels.
- Customer receiving preference and actual delivery result are distinct values. Do not silently change the preference when Rider submits a different successful result. Record actual outcome without inventing an exception-approval workflow.

## 12. Verification and provisional operational targets

Use unit tests for state transitions, date arithmetic, result/status mapping, validation and code generation behavior. Use integration tests against PostgreSQL for authorization, transactions, constraints, filters and races. Use a real local S3-compatible store for upload/storage integration, and fake SMS transport for automated tests. Use browser tests for complete journeys.

Required acceptance coverage:

| Coverage | Scenarios that must pass |
| --- | --- |
| CUS-01 | Valid code retrieves only its parcel; invalid code generic error; latest committed status appears; no sensitive fields/codes in public DTO |
| CUS-02 | All three options and instructions persist; only target parcel changes; instruction-only changes notify; no-op does not notify; Delivered edit rejected |
| DRV-01 | Date/code filters; required list/detail fields; contact copy; successful photo delivery; unreachable with optional photo; unauthorized parcel denied |
| DRV-02 | Bell count, persisted notifications, date/code filters, correct links/read status, no notification leakage |
| ADM-01 | Create/view/edit validation; vehicle enum; optional vehicle number; active Riders selectable; blocked deactivation with active undelivered parcels; login revocation |
| ADM-02 | Required From/To fields, COD validation, distinct codes under concurrency, admin code redisplay, valid customer tracking; SMS explicitly simulated/disabled or provider-tested |
| ADM-03 | Assignment appears on correct Rider/date; expected date adds three calendar days; reschedule/reassign preserves history; photo available only to authorized viewers |
| Consistency | Duplicate idempotent requests; different-payload replay conflict; stale version rejection; reassignment vs late delivery; preference change vs delivery completion; deactivate vs assignment race |
| Uploads | Valid JPEG/PNG; zero/multiple files as applicable; over-limit, forged MIME, corrupt image and excessive dimensions rejected; storage failure; DB failure cleanup; cross-parcel asset denied |
| Security | Role escalation, unauthenticated calls, other Rider IDs, tracking scope tampering, CSRF, expired sessions, former Rider photo access and rate-limit behavior |
| Persistence | Restart app and worker; parcels, notifications and photos remain; no reliance on process memory for operational data |

At least these Playwright journeys are required:

1. Admin creates Rider, provisions login, creates COD parcel, copies tracking code and assigns delivery.
2. Customer tracks that parcel, changes receiving place/instruction; assigned Rider sees the update and notification.
3. Rider submits Customer Unreachable; customer sees Delay; Rider retries with one valid delivery photo and successful result; customer sees Delivered; admin opens proof.
4. Admin reassigns another undelivered parcel; old Rider cannot access or submit; new Rider sees current preference and correct date.
5. A second Rider and a second tracking code cannot read/change the first parcel through manipulated IDs.

Check keyboard navigation, labels, focus, validation announcements, status contrast and mobile layouts. Run lint, TypeScript checking, unit/integration tests, production build and browser journeys through documented commands. Do not fake successful checks. If an environment prevents a check, record exact command, error and how to run it elsewhere.

Provisional engineering targets, subject to owner confirmation: on a documented local/staging environment with at least 10,000 synthetic parcels and 20 concurrent reads, indexed tracking and assignment-list endpoints should target p95 under one second excluding network latency and object upload. Updates should appear in other active views within 15 seconds plus request latency. Record measurements, hardware and query plans for slow queries; these are engineering goals, not contractual SLAs. No arbitrary production retention or uptime guarantee is approved.

## 13. Phased implementation and exit criteria

### Phase 0 — Repository assessment and decisions

Read repository guidance and source PRD, inventory code/dependencies, select supported stable versions, write decision/progress/acceptance documents, and record all defaults from section 3. If starting fresh, initialize Next.js App Router with TypeScript and the selected UI tooling. Set package-manager and Node-version expectations.

Exit: clear architecture and requirement checklist, runnable base app, locked dependencies and no unexplained scope gaps.

### Phase 1 — Infrastructure and schema

Set up PostgreSQL/MinIO Compose, environment validation, Prisma models/migrations/constraints, storage adapter, business-date utilities, enums, decimal helpers and seed command. Seed synthetic admins, at least five Riders, and parcels covering unassigned, assigned, unreachable, delivered and preference-change states. Use deterministic fixture references for browser tests but secure random real tracking tokens. Seed only explicit development environments.

Exit: fresh database migration and seed succeed; constraints and expected-date unit tests pass; restart retains data; private bucket works.

### Phase 2 — Authentication and policy enforcement

Implement admin/Rider login, setup credential lifecycle, forced initial password change, session revocation, active-account checks, role guards and ownership policies. Add secure cookie/CSRF configuration, rate-limit abstraction and protected layouts.

Exit: admin and two separate Riders can login; unauthorized role/resource tests fail safely; deactivated users lose access; no public registration.

### Phase 3 — Rider and parcel administration

Implement required Rider list filters, CRUD subset, deactivation rule and credential setup; parcel creation/list/detail with all fields, money validation, secure unique codes, safe tracking reveal/copy and audit events. Implement create idempotency.

Exit: ADM-01 and ADM-02 core tests pass and data persists; five seeded Rider rows render correctly.

### Phase 4 — Assignment workflow

Implement eligible parcel/Rider selectors, assignment creation, date handling, expected date display, list/detail, rescheduling and explicit reassignment. Add uniqueness, concurrency control and assignment notifications.

Exit: ADM-03 core passes; correct Rider/date visibility; conflicting assignments cannot be committed; old Rider loses current access after reassignment.

### Phase 5 — Customer tracking and preferences

Implement high-entropy code exchange, parcel-scoped short-lived session, safe tracking DTO, status display, preference/instruction form, delivered locking and transactionally persisted notifications. Configure no-store reads and refresh behavior.

Exit: CUS-01/CUS-02 tests pass; no cross-parcel writes or sensitive response leakage; changes appear to assigned Rider.

### Phase 6 — Rider results and proof

Implement mobile assignment list/detail, filters, copy contact, secure multipart validation/storage, staged-object cleanup, idempotent result submission, attempt history and customer status transitions. Add authorized photo viewing to admin detail and owning Rider history.

Exit: DRV-01 passes; successful delivery requires a valid photo; unreachable is retryable; failed storage/DB operations cannot produce false delivery success; races are covered.

### Phase 7 — Notifications and communication

Finish bell/unread/read flows, filters and safe deep links. Implement optional SMS adapter/outbox worker, retries and explicit disabled/local states. Document enabling a provider without inventing credentials or claiming real delivery.

Exit: DRV-02 passes; changes produce one relevant notification; outbox restart/retry tests pass; real-SMS status is truthfully reported.

### Phase 8 — End-to-end verification and operational handoff

Run all specified acceptance journeys and security/concurrency cases. Review mobile/accessibility/error states. Measure provisional performance, inspect query indexes, run production build and verify migrations against an empty database. Finish README, test evidence, deploy configuration, backup/restore steps and decisions list.

Exit: every PRD ID is traced to an implementation and passing verification or an explicit external-integration blocker; no hidden mock implementation remains; project runs from documented setup commands.

## 14. Setup and deployment contract

Provide equivalent runnable commands using the selected package manager for: install, Compose up, database migrate, seed, development server, outbox worker, lint, typecheck, unit tests, integration tests, browser tests and production build. A typical fresh clone should need only `.env` setup, dependency install, local services, migrations, seed and app start. Avoid scripts that destructively reset production data.

`.env.example` should cover database connection, auth secret/base URL, tracking encryption/HMAC keys, business timezone/currency, S3 endpoint/region/bucket/access credentials, upload limit, SMS adapter/enable flag/provider settings and shared rate-limit backend. Distinguish server secrets from public variables. Validate required server config on startup. Do not expose secrets using `NEXT_PUBLIC_`.

Document production app runtime, migration release step, private bucket/CORS permissions, worker hosting, HTTPS/cookie domain, request/file-size limits, database connection pooling, health checks and scheduled staged-photo cleanup. Provide readiness checks for database/storage without exposing configuration. Production must not silently start with development secrets, seed credentials or fake SMS success.

Document encrypted database backups and private-object backups, plus a restore rehearsal and custody of the tracking-code encryption key. Restoring the DB without object storage/key backup must be identified as incomplete. Retention/deletion periods require owner approval before automatic deletion of operational data or attached proof. Cleanup applies only to provably unattached staged objects, not historical evidence.

## 15. Definition of done and final Codex response

The application is complete when an admin can create and assign a parcel, its customer can track and update receiving preferences, the correct Rider sees those changes, a Rider can save a valid delivery result/photo, and customer/admin views show the same committed outcome with enforced ownership and durable data.

Before final handoff, confirm:

- All seven requirement IDs and cross-functional rules have implementation/test references.
- All required table fields and filters from the PRD are present.
- Operational persistence is PostgreSQL/private object storage, not browser localStorage or in-memory arrays.
- Customer status and Rider results remain distinct and consistently mapped.
- Codes, transactions, idempotency, reassignments and photo authorization withstand concurrent and manipulated requests.
- There are no placeholder buttons, fake notifications, publicly readable photo buckets or fabricated integration-success states.
- Setup/migrations/seed/build/test instructions are accurate and development credentials cannot leak into production.
- SMS/provider status, expected-date formula, mandatory-success-photo rule, currency and other provisional decisions are clearly documented.

The final Codex response should briefly state what was built, how to run it, checks actually executed and their outcomes, and remaining external configuration or decisions. Link the progress, acceptance and decision documents. Do not call the project production-ready if required verification or infrastructure remains incomplete.

## 16. Copyable kickoff prompt

Place this plan at `docs/IMPLEMENTATION_PLAN.md` and the source PRD in the repository, then give Codex the following instruction:

> Build the Parcel Delivery Management and Tracking System using Next.js. Read `docs/IMPLEMENTATION_PLAN.md` in full and the attached/source PRD, including its tables. Follow repository instructions and implement all phases autonomously, including PostgreSQL persistence, admin/Rider authentication and authorization, private photo storage, customer tracking, preferences, assignments, delivery results and in-app notifications. Treat the plan's marked defaults as reversible implementation decisions and record them in `docs/DECISIONS.md`; do not silently reinterpret the PRD. Maintain progress and requirement-to-test traceability. Use real local infrastructure and clearly labeled adapters where external credentials are unavailable. Continue until the complete local application, tests and setup documentation are delivered; do not stop after scaffolding or a UI-only prototype. Run the required checks, fix failures, and report exact results and any remaining production configuration. Do not deploy publicly or send real SMS without explicit authorization.
