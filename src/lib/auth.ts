import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "@/lib/db";
function createAuth() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("AUTH_SECRET must be at least 32 random characters.");
  return betterAuth({
    database: prismaAdapter(getDb(), { provider: "postgresql" }),
    secret,
    baseURL: process.env.APP_BASE_URL,
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
    },
    session: { expiresIn: 60 * 60 * 8, cookieCache: { enabled: false } },
    advanced: { database: { generateId: "uuid" } },
    trustedOrigins: [process.env.APP_BASE_URL ?? "http://localhost:3000"],
    plugins: [nextCookies()],
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const user = await getDb().user.findUnique({
              where: { id: session.userId },
              include: { rider: true },
            });
            if (!user?.active || (user.role === "RIDER" && !user.rider?.active))
              return false;
            return { data: session };
          },
        },
      },
    },
  });
}
let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  return (instance ??= createAuth());
}
