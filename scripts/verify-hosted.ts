import { validateConfig } from "../src/lib/config";
import { getDb } from "../src/lib/db";
import { getPrivateStore } from "../src/lib/storage";

validateConfig({ ...process.env, NODE_ENV: "production" });
const db = getDb();
try {
  await db.$queryRaw`SELECT 1`;
  await getPrivateStore().ready();
  console.info("PASS hosted PostgreSQL and private object storage connectivity");
} finally { await db.$disconnect(); }
