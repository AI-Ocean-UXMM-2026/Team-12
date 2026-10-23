import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";

// Only provisions an empty installation; never replaces an account or password.
if (process.env.ADMIN_BOOTSTRAP_EMAIL && process.env.ADMIN_BOOTSTRAP_PASSWORD) {
  const email = z.email().parse(process.env.ADMIN_BOOTSTRAP_EMAIL).toLowerCase();
  const password = await hashPassword(z.string().min(16).max(128).parse(process.env.ADMIN_BOOTSTRAP_PASSWORD));
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(230012)`;
      if (await tx.user.count({ where: { role: "ADMIN" } })) return;
      const user = await tx.user.create({ data: {
        email, name: "Administrator", role: "ADMIN", mustChangePassword: true,
      } });
      await tx.account.create({ data: { userId: user.id, providerId: "credential", accountId: user.id, password } });
    }, { maxWait: 20000, timeout: 30000 });
    console.info("Production administrator bootstrap checked; no existing credentials changed.");
  } finally { await db.$disconnect(); }
}
