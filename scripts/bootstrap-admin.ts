import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
const email = z.email().parse(process.env.ADMIN_BOOTSTRAP_EMAIL).toLowerCase();
const password = await hashPassword(
  z.string().min(12).max(128).parse(process.env.ADMIN_BOOTSTRAP_PASSWORD),
);
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
try {
  await db.$transaction(async (tx) => {
    if (await tx.user.findUnique({ where: { email } }))
      throw new Error(
        "Account already exists. Bootstrap does not replace credentials.",
      );
    const user = await tx.user.create({
      data: {
        email,
        name: "Administrator",
        role: "ADMIN",
        mustChangePassword: true,
      },
    });
    await tx.account.create({
      data: {
        userId: user.id,
        providerId: "credential",
        accountId: user.id,
        password,
      },
    });
  });
  console.info(
    "Administrator provisioned. Change the bootstrap password at first sign-in.",
  );
} finally {
  await db.$disconnect();
}
