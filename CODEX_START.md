# Continue this code starter with Codex

Paste the following prompt into Codex with this folder open as the repository root.

```text
Extend this existing Next.js code scaffold into the complete Parcel Delivery Management and Tracking System. Do not recreate the application or replace the existing working structure unnecessarily.

Read AGENTS.md, docs/PRD.md including every table, docs/IMPLEMENTATION_PLAN.md, docs/DECISIONS.md, docs/PROGRESS.md and docs/ACCEPTANCE.md. Inspect package.json, the current source, Prisma schema/migration and tests. The original PRD is docs/PRD.docx.

Install with npm ci, run the existing checks, and continue from incomplete phase-1 tasks. Complete phases 1–8 autonomously. The current screens are explicitly synthetic; implement authentication and server-side authorization before connecting them to operational data. Replace placeholders and fixtures with working authorized flows.

Implement persistent parcels and secure tracking codes, scoped customer preferences, Rider/account management, assignments/reassignment, delivery results/private photos, notifications, optional SMS outbox adapters and full PRD tests. Preserve reversible defaults and record actual decisions. Add the chosen maintained auth library and reconcile the initial identity schema/migrations. Do not mistake existing client factories or schema for complete domain implementation.

Keep progress, acceptance evidence, README and environment instructions current. Use real local infrastructure. Missing external provider credentials must not stop local core work; truthfully label simulated/disabled integrations. Run and fix lint/typecheck/tests/build and record the results. Continue until the locally runnable product and documentation are complete. Do not deploy publicly or send real SMS without explicit authorization.
```
