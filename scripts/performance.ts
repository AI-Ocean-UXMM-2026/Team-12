import "dotenv/config";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import {cpus,totalmem} from "node:os";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { digest, seal, token } from "../src/lib/crypto";
import { businessToday, expectedDeliveryDate } from "../src/lib/dates";
if (process.env.NODE_ENV !== "development")
  throw new Error(
    "Benchmark is restricted to explicit development configuration.",
  );
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const origin = process.env.APP_BASE_URL ?? "http://localhost:3000";
const targetCount = 100;
try {
  if (process.argv.includes("--seed")) {
    const admin = await db.user.findUniqueOrThrow({
      where: { email: "admin@parcel.test" },
    });
    const rider = await db.rider.findFirstOrThrow({
      where: { active: true, user: { email: "rider1@parcel.test" } },
    });
    const already = await db.parcel.count({
      where: { parcelCode: { startsWith: "PERF-" } },
    });
    const today = businessToday();
    for (let start = already; start < targetCount; start += 100) {
      const data = Array.from(
        { length: Math.min(100, targetCount - start) },
        (_, i) => {
          const value = token();
          return {
            id: randomUUID(),
            parcelCode: `PERF-${start + i}-${token().slice(0, 8)}`,
            trackingCodeHash: digest(value),
            ...seal(value),
            senderName: "Synthetic benchmark sender",
            receivedDate: new Date(today),
            receivedPerson: "Benchmark operator",
            createdByAdminId: admin.id,
            customerName: "Synthetic benchmark recipient",
            customerContactNumber: "09970000000",
            township: "Synthetic township",
            address: "Synthetic benchmark address",
            paymentType: "PREPAID" as const,
            deliveryFee: "1.00",
            customerStatus: "ON_THE_WAY" as const,
          };
        },
      );
      await db.$transaction(async (tx) => {
        await tx.parcel.createMany({ data });
        await tx.assignment.createMany({
          data: data.map((p) => ({
            parcelId: p.id,
            riderId: rider.id,
            assignedByAdminId: admin.id,
            assignDate: new Date(today),
            deliveryDate: new Date(today),
            expectedDeliveryDate: new Date(expectedDeliveryDate(today)),
          })),
        });
        await tx.$executeRaw`UPDATE "Parcel" p SET "currentAssignmentId"=a."id" FROM "Assignment" a WHERE a."parcelId"=p."id" AND p."parcelCode" LIKE 'PERF-%' AND p."currentAssignmentId" IS NULL`;
      });
    }
  }
  const count = await db.parcel.count();
  const benchmarkCount = await db.parcel.count({where:{parcelCode:{startsWith:"PERF-"}}});
  if (benchmarkCount < targetCount)
    throw new Error(
      "At least 100 synthetic benchmark parcels are required. Run with --seed against local development data.",
    );
  const fixture = await db.parcel.findFirstOrThrow({
    where: { parcelCode: { startsWith: "PERF-" } },
  });
  async function exchange(path: string, body: unknown) {
    const r = await fetch(origin + path, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`Authentication/exchange failed: ${r.status}`);
    return r.headers
      .getSetCookie()
      .map((s) => s.split(";", 1)[0])
      .join("; ");
  }
  const customerCookie = await exchange("/api/v1/tracking/exchange", {
    code: fixture.parcelCode,
  });
  const riderCookie = await exchange("/api/auth/sign-in/email", {
    email: "rider1@parcel.test",
    password: process.env.SEED_PASSWORD,
  });
  const report = [];
  for (const [name, path, cookie] of [
    ["tracking", "/api/v1/tracking", customerCookie],
    [
      "assignments",
      `/api/v1/rider/assignments?date=${businessToday()}`,
      riderCookie,
    ],
  ]) {
    const times: number[] = [];
    // Warm compiled routes and connections before measuring 20 simultaneous readers.
    await fetch(origin + path, { headers: { Cookie: cookie } });
    for (let batch = 0; batch < 5; batch++)
      await Promise.all(
        Array.from({ length: 20 }, async () => {
          const start = performance.now();
          const r = await fetch(origin + path, { headers: { Cookie: cookie } });
          await r.arrayBuffer();
          if (!r.ok) throw new Error(`Read failed: ${r.status}`);
          times.push(performance.now() - start);
        }),
      );
    times.sort((a, b) => a - b);
    report.push({
      endpoint: name,
      samples: times.length,
      concurrency: 20,
      p95Ms: Math.round(times[Math.ceil(times.length * 0.95) - 1]),
      maxMs: Math.round(times.at(-1)!),
    });
  }
  const plans = await db.$queryRaw<
    { "QUERY PLAN": unknown }[]
  >`EXPLAIN (FORMAT JSON) SELECT "id" FROM "Parcel" WHERE "parcelCode"=${fixture.parcelCode}`;
  console.info(
    JSON.stringify(
      {
        parcelCount: count,
        benchmarkParcelCount: benchmarkCount,
        requestedBenchmarkParcels: targetCount,
        runtime: process.version,
        platform: process.platform,
        hardware:{cpu:cpus()[0]?.model,logicalCpus:cpus().length,memoryGiB:Math.round(totalmem()/1024**3)},
        report,
        parcelCodeUniqueIndexUsed: JSON.stringify(plans).includes(
          "Parcel_parcelCode_key",
        ),
      },
      null,
      2,
    ),
  );
} finally {
  await db.$disconnect();
}
