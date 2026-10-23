import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const globalDb = globalThis as unknown as { prisma?: PrismaClient };
export function getDb(): PrismaClient {
  if (globalDb.prisma) return globalDb.prisma;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString)
    throw new Error("DATABASE_URL is required for database access.");
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString, max: 5, idleTimeoutMillis: 10000, connectionTimeoutMillis: 15000 }),
  });
  globalDb.prisma = client;
  return client;
}
