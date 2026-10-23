import "dotenv/config";
import { defineConfig } from "prisma/config";
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node --conditions=react-server --import tsx prisma/seed.ts",
  },
  // CLI generation works before .env exists. Runtime code requires a real URL.
  datasource: {
    url:
      process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ??
      "postgresql://parcel_dev:parcel_dev_local@localhost:5432/parcel_delivery",
  },
});
