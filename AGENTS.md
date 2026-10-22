# Instructions for Codex

## Goal and reading order

Extend the existing Next.js code scaffold into the complete Parcel Delivery Management and Tracking System. Begin by reading this file, `docs/PRD.md` (including tables), `docs/IMPLEMENTATION_PLAN.md`, `docs/DECISIONS.md`, `docs/PROGRESS.md` and `docs/ACCEPTANCE.md`. The original `docs/PRD.docx` is included for verification. Inspect any existing repository code and additional instructions before changing it.

## Source precedence

Follow explicit current owner instructions first, then repository instructions. The PRD supplies product requirements; the plan resolves identified ambiguities using marked reversible defaults. If sources conflict, document the discrepancy and follow the plan's explicitly labeled default unless the owner has superseded it. Do not silently drop requirements or portray assumptions as approved facts.

## Execution

- Implement phases 0 through 8 from the plan. Start at the first incomplete phase and continue through all locally feasible phases without stopping after scaffolding.
- Keep this repository as the application root. The specification files already occupy it; preserve the existing scaffold and documents without leaving the app in an accidental nested directory.
- Use Next.js App Router and strict TypeScript. Select compatible supported stable dependencies at implementation time and commit one package-manager lockfile.
- Use real PostgreSQL persistence and private object storage locally. Do not substitute arrays, localStorage or fake-success adapters for operational behavior.
- Implement server-side role/resource authorization on every read and mutation. Keep domain rules in reusable server services.
- Implement uniqueness, idempotency and concurrency rules through database-backed invariants and transactions.
- Missing external credentials may block external verification, but must not prevent building local core workflows. Label local/disabled adapters truthfully.
- Keep `docs/PROGRESS.md`, `docs/DECISIONS.md` and `docs/ACCEPTANCE.md` accurate as work proceeds. Replace README placeholders with verified commands.
- Preserve source PRD files. Do not edit requirements to make an incomplete implementation appear compliant.

## Verification and completion

Run checks appropriate to each phase, fix failures, and complete the plan's acceptance journeys. Record commands, dates, results and external blockers honestly. Completion requires all three interfaces, persistence, authorization, delivery photo handling, consistent statuses, notifications, tests and local setup documentation. Screens alone do not satisfy the request.

Do not add out-of-scope payments, GPS, route optimization, customer registration or analytics. Never commit credentials, private photos or recipient data. Do not publicly deploy or send real SMS without explicit owner authorization. Do not destructively reset production data.

At handoff, report implemented features, actual run commands, tests actually executed, documented defaults and remaining production configuration. Do not claim production readiness when verification or infrastructure is incomplete.

## Existing code status

A working Next.js starter already exists. Run `npm ci`, inspect the source and `docs/PROGRESS.md`, then continue from unfinished phase-1 work. Do not reinitialize the app. Sample UI data in `src/lib/demo-data.ts` must be replaced by authorized database access during implementation, never treated as a production repository. Current admin/Rider routes are public sample screens with no real data, not protected product routes. Add authentication before operational data access. Rider.userId is nullable only for staged seed profiles; assignment policies must require an active provisioned user. Reconcile the initial User model with the selected auth library. Do not treat the existing migration/schema as complete enforcement of all service-level invariants.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
