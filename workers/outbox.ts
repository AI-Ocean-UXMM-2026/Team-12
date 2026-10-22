import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { pathToFileURL } from "node:url";
export interface SmsAdapter {
  send(
    eventId: string,
    protectedPayload: string,
  ): Promise<{ mode: "simulated"; reference: string }>;
}
export class LocalSmsAdapter implements SmsAdapter {
  async send(eventId: string, _protectedPayload: string) {
    void _protectedPayload;
    console.info(
      `SIMULATED SMS event ${eventId}; recipient and tracking code redacted. No real SMS sent.`,
    );
    return { mode: "simulated" as const, reference: eventId };
  }
}
export async function processOutbox(
  db: PrismaClient,
  adapter: SmsAdapter = new LocalSmsAdapter(),
) {
  if (process.env.SMS_ENABLED !== "true") {
    console.info("SMS disabled; no messages claimed or sent.");
    return 0;
  }
  if (process.env.SMS_ADAPTER !== "local")
    throw new Error(
      "No approved real SMS adapter configured. Sending is refused.",
    );
  if (process.env.NODE_ENV === "production")
    throw new Error("Local SMS simulation is not permitted in production.");
  await db.outboxEvent.updateMany({
    where: {
      state: "PROCESSING",
      attemptCount: { gte: 5 },
      lockedAt: { lt: new Date(Date.now() - 300000) },
    },
    data: {
      state: "FAILED",
      lockedAt: null,
      lastError:
        "Worker lease expired after maximum attempts; payload redacted",
    },
  });
  const jobs = await db.$queryRaw<
    { id: string; protectedPayload: string; attemptCount: number }[]
  >`
    WITH candidates AS (SELECT "id" FROM "OutboxEvent" WHERE
    (("state"='PENDING' AND "nextAttemptAt"<=NOW()) OR ("state"='PROCESSING' AND "lockedAt"<NOW()-INTERVAL '5 minutes'))
    AND "attemptCount"<5 ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 10)
    UPDATE "OutboxEvent" e SET "state"='PROCESSING',"lockedAt"=NOW(),"attemptCount"=e."attemptCount"+1
    FROM candidates c WHERE e."id"=c."id" RETURNING e."id",e."protectedPayload",e."attemptCount"`;
  for (const job of jobs) {
    try {
      await adapter.send(job.id, job.protectedPayload);
      await db.outboxEvent.update({
        where: { id: job.id },
        data: {
          state: "SENT",
          sentAt: new Date(),
          lockedAt: null,
          lastError: "SIMULATED: no real SMS sent",
        },
      });
    } catch {
      await db.outboxEvent.update({
        where: { id: job.id },
        data: {
          state: job.attemptCount >= 5 ? "FAILED" : "PENDING",
          lockedAt: null,
          lastError: "Adapter failed; payload redacted",
          nextAttemptAt: new Date(
            Date.now() + Math.min(3600, 2 ** job.attemptCount * 10) * 1000,
          ),
        },
      });
    }
  }
  return jobs.length;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  try {
    await processOutbox(db);
  } finally {
    await db.$disconnect();
  }
}
