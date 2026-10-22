import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { processOutbox, type SmsAdapter } from "../../workers/outbox";
import { seal } from "../../src/lib/crypto";
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
process.env.SMS_ENABLED = "true";
process.env.SMS_ADAPTER = "local";
try {
  const event = await db.outboxEvent.create({
    data: {
      eventType: "TEST_LOCAL_SMS",
      entityId: randomUUID(),
      deduplicationKey: randomUUID(),
      protectedPayload: JSON.stringify(
        seal("Synthetic local communication test"),
      ),
    },
  });
  const failing: SmsAdapter = {
    async send() {
      throw new Error("Synthetic transient failure");
    },
  };
  await processOutbox(db, failing);
  let current = await db.outboxEvent.findUniqueOrThrow({
    where: { id: event.id },
  });
  assert.equal(current.state, "PENDING");
  assert.equal(current.attemptCount, 1);
  assert(current.nextAttemptAt > new Date());
  await db.outboxEvent.update({
    where: { id: event.id },
    data: { nextAttemptAt: new Date(0) },
  });
  const claims = new Set<string>();
  const successful: SmsAdapter = {
    async send(id) {
      assert(!claims.has(id));
      claims.add(id);
      return { mode: "simulated", reference: id };
    },
  };
  await Promise.all([
    processOutbox(db, successful),
    processOutbox(db, successful),
  ]);
  current = await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
  assert.equal(current.state, "SENT");
  assert.equal(current.attemptCount, 2);
  assert(current.lastError?.includes("SIMULATED"));
  const expired = await db.outboxEvent.create({
    data: {
      eventType: "TEST_LOCAL_SMS",
      entityId: randomUUID(),
      deduplicationKey: randomUUID(),
      protectedPayload: "redacted",
      state: "PROCESSING",
      attemptCount: 5,
      lockedAt: new Date(0),
    },
  });
  await processOutbox(db, successful);
  assert.equal(
    (await db.outboxEvent.findUniqueOrThrow({ where: { id: expired.id } }))
      .state,
    "FAILED",
  );
  const recovered = await db.outboxEvent.create({
    data: {
      eventType: "TEST_LOCAL_SMS",
      entityId: randomUUID(),
      deduplicationKey: randomUUID(),
      protectedPayload: "redacted",
      state: "PROCESSING",
      attemptCount: 1,
      lockedAt: new Date(0),
    },
  });
  await processOutbox(db, successful);
  assert.equal(
    (await db.outboxEvent.findUniqueOrThrow({ where: { id: recovered.id } }))
      .state,
    "SENT",
  );
  process.env.SMS_ENABLED = "false";
  assert.equal(await processOutbox(db, successful), 0);
  console.info(
    "PASS durable outbox retry, concurrent claiming, lease recovery, exhausted failure and disabled SMS; all transports simulated",
  );
} finally {
  await db.$disconnect();
}
