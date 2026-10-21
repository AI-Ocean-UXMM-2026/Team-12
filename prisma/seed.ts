import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
if (process.env.NODE_ENV !== "development") throw new Error("Seed is restricted to explicit NODE_ENV=development.");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const riders = [
  { id:"00000000-0000-4000-8000-000000000001",name:"Aung Min",contactNumber:"09970000001",vehicleType:"DELIVERY_VAN" as const,vehicleNumber:"DEMO-V001" },
  { id:"00000000-0000-4000-8000-000000000002",name:"Thiri Aye",contactNumber:"09970000002",vehicleType:"CAR" as const,vehicleNumber:"DEMO-C002" },
  { id:"00000000-0000-4000-8000-000000000003",name:"Ko Zaw",contactNumber:"09970000003",vehicleType:"BICYCLE" as const,vehicleNumber:null },
  { id:"00000000-0000-4000-8000-000000000004",name:"May Thu",contactNumber:"09970000004",vehicleType:"CAR" as const,vehicleNumber:"DEMO-C004" },
  { id:"00000000-0000-4000-8000-000000000005",name:"Htet Lin",contactNumber:"09970000005",vehicleType:"DELIVERY_VAN" as const,vehicleNumber:"DEMO-V005" },
];
try {
  for (const rider of riders) await db.rider.upsert({ where:{id:rider.id},create:rider,update:{} });
  console.info("Seeded five synthetic Rider profiles. Login accounts are not provisioned in this scaffold.");
} finally { await db.$disconnect(); }
