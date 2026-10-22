import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { z } from "zod";
const id = z.uuid().parse(process.argv[2]);
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
try {
  const r = await db.outboxEvent.updateMany({
    where: { id, state: "FAILED" },
    data: {
      state: "PENDING",
      attemptCount: 0,
      nextAttemptAt: new Date(),
      lockedAt: null,
      lastError: null,
    },
  });
  console.info(
    `Queued ${r.count} previously failed event for retry; no message sent by this command.`,
  );
} finally {
  await db.$disconnect();
}
