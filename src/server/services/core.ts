import "server-only";
import { getDb } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { createHash } from "node:crypto";
import { invariant } from "@/server/errors";
export type Tx = Prisma.TransactionClient;
export async function transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  for (let n = 0; ; n++) {
    try {
      return await getDb().$transaction(work, {
        isolationLevel: "Serializable",
        timeout: 15000,
        maxWait: 15000,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2034" ||
          error.code === "P2002" ||
          (error.code === "P2010" &&
            /["'](?:40001|40P01)["']|TransactionWriteConflict|could not serialize|deadlock detected/.test(
              JSON.stringify(error.meta),
            ))) &&
        n < 3
      )
        continue;
      throw error;
    }
  }
}
export async function lockParcel(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "Parcel" WHERE "id"=${id}::uuid FOR UPDATE`;
  const p = await tx.parcel.findUnique({
    where: { id },
    include: { currentAssignment: true },
  });
  invariant(p, 404, "Parcel unavailable.");
  return p;
}
export async function idempotent<T extends Prisma.InputJsonValue>(
  tx: Tx,
  actorId: string,
  action: string,
  key: string,
  payload: unknown,
  work: () => Promise<T>,
): Promise<T> {
  invariant(
    key.length >= 16 && key.length <= 128,
    422,
    "An idempotency key of 16–128 characters is required.",
  );
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${actorId + action + key},0))::text`;
  const previous = await tx.idempotencyRecord.findUnique({
    where: { actorId_action_key: { actorId, action, key } },
  });
  if (previous) {
    invariant(
      previous.requestFingerprint === fingerprint,
      409,
      "This request key was used with different values.",
    );
    return previous.response as T;
  }
  const response = await work();
  await tx.idempotencyRecord.create({
    data: {
      actorId,
      action,
      key,
      requestFingerprint: fingerprint,
      response,
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  return response;
}
export async function audit(
  tx: Tx,
  actorId: string,
  eventType: string,
  parcelId?: string,
  metadata: Prisma.InputJsonObject = {},
) {
  await tx.auditEvent.create({
    data: { actorId, actorType: "USER", eventType, parcelId, metadata },
  });
}
export async function notify(
  tx: Tx,
  riderId: string,
  parcelId: string,
  assignmentId: string,
  type: string,
  removed = false,
) {
  const p = await tx.parcel.findUniqueOrThrow({ where: { id: parcelId } });
  const a = await tx.assignment.findUniqueOrThrow({
    where: { id: assignmentId },
  });
  await tx.riderNotification.create({
    data: {
      riderId,
      parcelId: removed ? null : parcelId,
      assignmentId: removed ? null : assignmentId,
      type,
      deliveryDate: a.deliveryDate,
      snapshot: removed
        ? {
            parcelCode: p.parcelCode,
            message:
              "Assignment removed. Current parcel details are unavailable.",
          }
        : {
            parcelCode: p.parcelCode,
            customerName: p.customerName,
            customerContactNumber: p.customerContactNumber,
            receivingOption: p.receivingOption,
            deliveryInstruction: p.deliveryInstruction ?? "",
            message:
              type === "PREFERENCES_CHANGED"
                ? `${p.customerName} changed receiving option for ${p.parcelCode}.`
                : type === "INSTRUCTIONS_CHANGED"
                  ? `${p.customerName} changed delivery instructions for ${p.parcelCode}.`
                  : type.replaceAll("_", " "),
          },
    },
  });
}
