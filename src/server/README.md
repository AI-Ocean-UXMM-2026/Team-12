# Server boundaries

This directory is reserved for the production workflows defined in the plan. No operational API is connected to the sample UI.

- `policies`: authenticated identity, active-user checks and parcel/assignment ownership; deny by default.
- `services`: transaction boundaries and domain orchestration; no direct request-body ORM writes.
- `repositories`: typed PostgreSQL access behind services.
- `notifications`: persisted events and recipient scoping.
- `sms`: disabled/local/provider adapters and outbox delivery.

Do not expose `getDb()` through routes before authentication, authorization and input validation are implemented. `GET /api/health` is the only current API and is liveness only. Authentication library selection/integration remains phase 2 work.
