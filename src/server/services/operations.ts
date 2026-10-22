import "server-only";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { actor } from "@/server/security";
import { getDb } from "@/lib/db";
import { digest, seal, token } from "@/lib/crypto";
import { riderSchema } from "@/lib/validation/rider";
import {
  assignmentSchema,
  parcelSchema,
  preferenceSchema,
} from "@/lib/validation/workflows";
import { expectedDeliveryDate } from "@/lib/dates";
import { audit, idempotent, lockParcel, notify, transaction } from "./core";
import { invariant } from "@/server/errors";

export async function saveRider(input: unknown, id?: string) {
  const user = await actor("ADMIN");
  const data = riderSchema
    .extend({
      email: z.email().max(254).optional(),
      version: z.number().int().optional(),
      active: z.boolean().optional(),
      resetAccess: z.boolean().optional(),
    })
    .parse(input);
  const setupPassword = token();
  const password = await hashPassword(setupPassword);
  return transaction(async (tx) => {
    const fields = {
      name: data.name,
      contactNumber: data.contactNumber,
      vehicleType: data.vehicleType,
      vehicleNumber: data.vehicleNumber || null,
    };
    if (!id) {
      invariant(data.email, 422, "Login email is required.");
      const account = await tx.user.create({
        data: {
          email: data.email.toLowerCase(),
          name: data.name,
          role: "RIDER",
          accounts: {
            create: {
              id: randomUUID(),
              accountId: randomUUID(),
              providerId: "credential",
              password,
            },
          },
        },
      });
      await tx.account.updateMany({
        where: { userId: account.id },
        data: { accountId: account.id },
      });
      const rider = await tx.rider.create({
        data: { ...fields, userId: account.id },
      });
      await audit(tx, user.id, "RIDER_CREATED", undefined, {
        riderId: rider.id,
      });
      return { id: rider.id, setupPassword };
    }
    await tx.$queryRaw`SELECT "id" FROM "Rider" WHERE "id"=${id}::uuid FOR UPDATE`;
    const rider = await tx.rider.findUnique({ where: { id } });
    invariant(rider, 404, "Rider unavailable.");
    invariant(
      rider.version === data.version,
      409,
      "Rider changed. Reload and review.",
    );
    if (data.active === false)
      invariant(
        (await tx.assignment.count({
          where: { riderId: id, lifecycle: "ACTIVE" },
        })) === 0,
        409,
        "Reassign undelivered parcels before deactivating this Rider.",
      );
    await tx.rider.update({
      where: { id },
      data: {
        ...fields,
        active: data.active ?? rider.active,
        version: { increment: 1 },
      },
    });
    invariant(
      rider.userId,
      409,
      "Provision this staged profile through the seed/bootstrap command first.",
    );
    await tx.user.update({
      where: { id: rider.userId },
      data: {
        name: data.name,
        active: data.active ?? rider.active,
        ...(data.resetAccess
          ? { mustChangePassword: true, sessionVersion: { increment: 1 } }
          : {}),
      },
    });
    if (data.active === false || data.resetAccess)
      await tx.session.deleteMany({ where: { userId: rider.userId } });
    if (data.resetAccess)
      await tx.account.updateMany({
        where: { userId: rider.userId, providerId: "credential" },
        data: { password },
      });
    await audit(tx, user.id, "RIDER_UPDATED", undefined, {
      riderId: id,
      resetAccess: !!data.resetAccess,
    });
    return { id, ...(data.resetAccess ? { setupPassword } : {}) };
  });
}
export async function createParcel(input: unknown, key: string) {
  const user = await actor("ADMIN");
  const data = parcelSchema.parse(input);
  for (let collision = 0; ; collision++) {
    try {
      return await transaction((tx) =>
        idempotent(tx, user.id, "CREATE_PARCEL", key, data, async () => {
          const tracking = token();
          const parcel = await tx.parcel.create({
            data: {
              ...data,
              receivedDate: new Date(data.receivedDate),
              parcelCode: `P-${token().slice(0, 12).toUpperCase()}`,
              trackingCodeHash: digest(tracking),
              ...seal(tracking),
              createdByAdminId: user.id,
              currency: process.env.APP_CURRENCY ?? "MMK",
            },
          });
          await audit(tx, user.id, "PARCEL_CREATED", parcel.id);
          return { id: parcel.id };
        }),
      );
    } catch (e) {
      if (
        collision < 3 &&
        e instanceof Error &&
        "code" in e &&
        e.code === "P2002"
      )
        continue;
      throw e;
    }
  }
}
export async function assignParcel(input: unknown, key: string) {
  const user = await actor("ADMIN");
  const data = assignmentSchema.parse(input);
  return transaction((tx) =>
    idempotent(tx, user.id, "ASSIGN", key, data, async () => {
      await tx.$queryRaw`SELECT "id" FROM "Rider" WHERE "id"=${data.riderId}::uuid FOR UPDATE`;
      const rider = await tx.rider.findUnique({
        where: { id: data.riderId },
        include: { user: true },
      });
      invariant(
        rider?.active && rider.user?.active,
        422,
        "Choose an active provisioned Rider.",
      );
      const p = await lockParcel(tx, data.parcelId);
      invariant(
        p.version === data.version,
        409,
        "Parcel changed. Reload and review.",
      );
      invariant(
        p.customerStatus !== "DELIVERED",
        409,
        "Delivered parcels are read-only.",
      );
      const dates = {
        assignDate: new Date(data.assignDate),
        deliveryDate: new Date(data.deliveryDate),
        expectedDeliveryDate: new Date(expectedDeliveryDate(data.deliveryDate)),
      };
      let a = p.currentAssignment;
      const before = a
        ? {
            assignDate: a.assignDate.toISOString(),
            deliveryDate: a.deliveryDate.toISOString(),
            riderId: a.riderId,
          }
        : {};
      if (data.mode === "reschedule") {
        invariant(
          a?.lifecycle === "ACTIVE" && a.riderId === data.riderId,
          409,
          "Current assignment required for reschedule.",
        );
        a = await tx.assignment.update({
          where: { id: a.id },
          data: { ...dates, version: { increment: 1 } },
        });
      } else {
        invariant(
          data.mode === "reassign" ? !!a && a.riderId !== data.riderId : !a,
          409,
          "Use explicit reassignment for an assigned parcel.",
        );
        if (a) {
          await tx.assignment.update({
            where: { id: a.id },
            data: {
              lifecycle: "REASSIGNED",
              endedAt: new Date(),
              version: { increment: 1 },
            },
          });
          await notify(tx, a.riderId, p.id, a.id, "ASSIGNMENT_REMOVED", true);
        }
        a = await tx.assignment.create({
          data: {
            parcelId: p.id,
            riderId: data.riderId,
            assignedByAdminId: user.id,
            ...dates,
          },
        });
      }
      await tx.parcel.update({
        where: { id: p.id },
        data: {
          currentAssignmentId: a.id,
          customerStatus:
            data.mode === "reschedule" ? p.customerStatus : "ON_THE_WAY",
          version: { increment: 1 },
        },
      });
      await notify(
        tx,
        a.riderId,
        p.id,
        a.id,
        data.mode === "reschedule" ? "SCHEDULE_CHANGED" : "ASSIGNED",
      );
      await audit(tx, user.id, data.mode.toUpperCase(), p.id, {
        assignmentId: a.id,
        before,
      });
      return { id: a.id };
    }),
  );
}
export async function updatePreferences(parcelId: string, input: unknown) {
  const data = preferenceSchema.parse(input);
  return transaction(async (tx) => {
    const p = await lockParcel(tx, parcelId);
    invariant(
      p.version === data.version,
      409,
      "Parcel changed. Refresh and review the latest delivery details.",
    );
    invariant(
      p.customerStatus !== "DELIVERED",
      409,
      "Delivered parcels are read-only.",
    );
    if (
      p.receivingOption === data.receivingOption &&
      (p.deliveryInstruction ?? "") === data.deliveryInstruction
    )
      return { id: p.id };
    await tx.parcel.update({
      where: { id: p.id },
      data: {
        receivingOption: data.receivingOption,
        deliveryInstruction: data.deliveryInstruction,
        version: { increment: 1 },
      },
    });
    if (p.currentAssignment)
      await notify(
        tx,
        p.currentAssignment.riderId,
        p.id,
        p.currentAssignment.id,
        p.receivingOption===data.receivingOption?"INSTRUCTIONS_CHANGED":"PREFERENCES_CHANGED",
      );
    await tx.auditEvent.create({
      data: {
        actorType: "CUSTOMER",
        actorId: parcelId,
        parcelId,
        eventType: "PREFERENCES_CHANGED",
        metadata: { receivingOption: data.receivingOption },
      },
    });
    return { id: p.id };
  });
}
export async function trackingView(parcelId: string) {
  const p = await getDb().parcel.findUnique({
    where: { id: parcelId },
    select: {
      parcelCode: true,
      customerStatus: true,
      receivingOption: true,
      deliveryInstruction: true,
      version: true,
      currentAssignment: {
        select: { deliveryDate: true, expectedDeliveryDate: true },
      },
    },
  });
  invariant(p, 404, "Parcel unavailable.");
  return p;
}
