# Background worker

Implement the database-backed outbox worker in phase 7. It must claim jobs transactionally, retry transient errors, redact private payloads, and truthfully distinguish local simulation from real SMS delivery. No worker is running or implemented in this scaffold.
