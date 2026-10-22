import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient, type Rider } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { digest, seal, token } from "../src/lib/crypto";
import { expectedDeliveryDate } from "../src/lib/dates";
import { getPrivateStore } from "../src/lib/storage";
import sharp from "sharp";
import { createHash } from "node:crypto";
if (process.env.NODE_ENV !== "development")
  throw new Error("Seed requires explicit NODE_ENV=development.");
if (!process.env.SEED_PASSWORD || process.env.SEED_PASSWORD.length < 12)
  throw new Error(
    "Set SEED_PASSWORD to a private local password of at least 12 characters.",
  );
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const password = await hashPassword(process.env.SEED_PASSWORD);
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: process.env.BUSINESS_TIMEZONE ?? "Asia/Yangon",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
async function provision(email: string, name: string, role: "ADMIN" | "RIDER") {
  const user = await db.user.upsert({
    where: { email },
    update: {},
    create: { email, name, role, mustChangePassword: false },
  });
  await db.account.upsert({
    where: {
      providerId_accountId: { providerId: "credential", accountId: user.id },
    },
    update: {},
    create: {
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password,
    },
  });
  return user;
}
try {
  const store = getPrivateStore();
  await store.ready();
  const admin = await provision(
    "admin@parcel.test",
    "Local Administrator",
    "ADMIN",
  );
  const riders: Rider[] = [];
  for (const [index, name] of [
    "Aung Min",
    "Thiri Aye",
    "Ko Zaw",
    "May Thu",
    "Htet Lin",
  ].entries()) {
    const user = await provision(
      `rider${index + 1}@parcel.test`,
      name,
      "RIDER",
    );
    const id = `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    riders.push(
      await db.rider.upsert({
        where: { id },
        update: { userId: user.id },
        create: {
          id,
          userId: user.id,
          name,
          contactNumber: `0997000000${index + 1}`,
          vehicleType: (["DELIVERY_VAN", "CAR", "BICYCLE"] as const)[index % 3],
          vehicleNumber: index === 2 ? null : `DEMO-${index + 1}`,
        },
      }),
    );
  }
  for (let i = 0; i < 5; i++) {
    const parcelCode = `SEED-${i + 1}`;
    if (await db.parcel.findUnique({ where: { parcelCode } })) continue;
    const tracking = token();
    await db.$transaction(async (tx) => {
      const p = await tx.parcel.create({
        data: {
          parcelCode,
          trackingCodeHash: digest(tracking),
          ...seal(tracking),
          senderName: "Synthetic sender",
          receivedDate: new Date(today),
          receivedPerson: "Seed operator",
          createdByAdminId: admin.id,
          customerName: `Synthetic recipient ${i + 1}`,
          customerContactNumber: "09970000999",
          township: "Sanchaung",
          address: "Synthetic local-test address",
          paymentType: i % 2 ? "COD" : "PREPAID",
          orderAmount: i % 2 ? "25000.00" : null,
          deliveryFee: "2000.00",
          deliveryInstruction: i === 3 ? "Please ring the bell." : null,
          receivingOption: i === 3 ? "NEIGHBOUR" : "HOME",
        },
      });
      if (i > 0) {
        const a = await tx.assignment.create({
          data: {
            parcelId: p.id,
            riderId: riders[0].id,
            assignedByAdminId: admin.id,
            assignDate: new Date(today),
            deliveryDate: new Date(today),
            expectedDeliveryDate: new Date(expectedDeliveryDate(today)),
            latestResult: i === 2 ? "CUSTOMER_UNREACHABLE" : null,
          },
        });
        await tx.parcel.update({
          where: { id: p.id },
          data: {
            currentAssignmentId: a.id,
            customerStatus: i === 2 ? "DELAY" : "ON_THE_WAY",
          },
        });
        if (i === 2)
          await tx.deliveryAttempt.create({
            data: {
              assignmentId: a.id,
              parcelId: p.id,
              riderId: riders[0].id,
              result: "CUSTOMER_UNREACHABLE",
              idempotencyKey: randomUUID(),
            },
          });
        if (i === 3)
          await tx.riderNotification.create({
            data: {
              riderId: riders[0].id,
              parcelId: p.id,
              assignmentId: a.id,
              type: "PREFERENCES_CHANGED",
              deliveryDate: a.deliveryDate,
              snapshot: {
                parcelCode,
                customerName: p.customerName,
                customerContactNumber: p.customerContactNumber,
                receivingOption: "NEIGHBOUR",
                deliveryInstruction: "Please ring the bell.",
                message: `${p.customerName} changed receiving option for ${parcelCode}.`,
              },
            },
          });
        if (i === 4) {
          const bytes = await sharp({
            create: {
              width: 32,
              height: 32,
              channels: 3,
              background: "#487ac4",
            },
          })
            .jpeg()
            .toBuffer();
          const storageKey = `proof/${randomUUID()}.jpg`;
          await store.put(storageKey, bytes);
          const photo = await tx.photoAsset.create({
            data: {
              storageKey,
              detectedMime: "image/jpeg",
              byteSize: bytes.length,
              checksum: createHash("sha256").update(bytes).digest("hex"),
              uploaderId: riders[0].userId!,
              parcelId: p.id,
              assignmentId: a.id,
              lifecycle: "ATTACHED",
            },
          });
          await tx.deliveryAttempt.create({
            data: {
              assignmentId: a.id,
              parcelId: p.id,
              riderId: riders[0].id,
              result: "DELIVERED_HOME",
              photoAssetId: photo.id,
              idempotencyKey: randomUUID(),
            },
          });
          await tx.assignment.update({
            where: { id: a.id },
            data: {
              lifecycle: "COMPLETED",
              latestResult: "DELIVERED_HOME",
              endedAt: new Date(),
            },
          });
          await tx.parcel.update({
            where: { id: p.id },
            data: { customerStatus: "DELIVERED", deliveredAt: new Date() },
          });
        }
      }
    });
  }
  console.info(
    "Seeded local admin, five provisioned Riders, and five durable workflow fixtures including private delivery proof. Password comes from SEED_PASSWORD; no tracking codes are logged.",
  );
} finally {
  await db.$disconnect();
}
