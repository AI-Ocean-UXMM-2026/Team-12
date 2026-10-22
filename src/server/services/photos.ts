import "server-only";
import { randomUUID } from "node:crypto";
import { sanitizePhoto } from "@/lib/photo";
import { getPrivateStore } from "@/lib/storage";
import { getDb } from "@/lib/db";
import { actor, rateLimit } from "@/server/security";
import { invariant } from "@/server/errors";
import { resultSchema } from "@/lib/validation/workflows";
import { audit, idempotent, lockParcel, transaction } from "./core";
import { statusForResult } from "@/domain/delivery";

export async function submitResult(assignmentId: string, form: FormData) {
  const user = await actor("RIDER");
  const rider = user.rider!;
  await rateLimit(`upload:${user.id}`, 20);
  const data = resultSchema.parse({
    result: form.get("result"),
    version: form.get("version"),
    idempotencyKey: form.get("idempotencyKey"),
  });
  const files = form
    .getAll("photo")
    .filter((f): f is File => f instanceof File && f.size > 0);
  invariant(files.length <= 1, 422, "Only one photo may be uploaded.");
  invariant(
    data.result === "CUSTOMER_UNREACHABLE" || files.length === 1,
    422,
    "A delivery photo is required for a successful delivery.",
  );
  // Authorize before reading or storing the submitted image.
  const authorized = await getDb().assignment.findFirst({
    where: {
      id: assignmentId,
      riderId: rider.id,
      parcel: { currentAssignmentId: assignmentId },
    },
    include: { parcel: true },
  });
  invariant(authorized, 404, "Assignment unavailable.");
  const photo = files[0]
    ? await sanitizePhoto(Buffer.from(await files[0].arrayBuffer()))
    : null;
  const fingerprint = {
    assignmentId,
    ...data,
    checksum: photo?.checksum ?? null,
  };
  // Replay is checked before terminal-state validation so retries after a saved delivery succeed.
  const previous = await getDb().idempotencyRecord.findUnique({
    where: {
      actorId_action_key: {
        actorId: user.id,
        action: "DELIVER",
        key: data.idempotencyKey,
      },
    },
  });
  if (previous)
    return transaction((tx) =>
      idempotent(
        tx,
        user.id,
        "DELIVER",
        data.idempotencyKey,
        fingerprint,
        async () => ({ id: "unreachable" }),
      ),
    );
  invariant(
    authorized.lifecycle === "ACTIVE",
    409,
    "This assignment is complete or has changed.",
  );
  let assetId: string | undefined;
  if (photo) {
    const storageKey = `proof/${randomUUID()}.jpg`;
    const asset = await getDb().photoAsset.create({
      data: {
        storageKey,
        detectedMime: "image/jpeg",
        byteSize: photo.bytes.length,
        checksum: photo.checksum,
        uploaderId: user.id,
        parcelId: authorized.parcelId,
        assignmentId,
      },
    });
    assetId = asset.id;
    try {
      await getPrivateStore().put(storageKey, photo.bytes);
    } catch {
      await getDb().photoAsset.update({
        where: { id: asset.id },
        data: { lifecycle: "DELETE_PENDING" },
      });
      invariant(
        false,
        503,
        "Photo storage is unavailable. Your result was not saved.",
      );
    }
  }
  try {
    return await transaction((tx) =>
      idempotent(
        tx,
        user.id,
        "DELIVER",
        data.idempotencyKey,
        fingerprint,
        async () => {
          const p = await lockParcel(tx, authorized.parcelId);
          const a = p.currentAssignment;
          invariant(
            a?.id === assignmentId &&
              a.riderId === rider.id &&
              a.lifecycle === "ACTIVE",
            409,
            "Assignment changed. Refresh your route.",
          );
          const activeUser = await tx.user.findUnique({
            where: { id: user.id },
            include: { rider: true },
          });
          invariant(
            activeUser?.active && activeUser.rider?.active,
            403,
            "Rider is inactive.",
          );
          invariant(
            p.version === data.version,
            409,
            "Delivery details changed. Refresh and review before submitting.",
          );
          invariant(
            p.customerStatus !== "DELIVERED",
            409,
            "Parcel already delivered.",
          );
          const status = statusForResult(data.result);
          const attempt = await tx.deliveryAttempt.create({
            data: {
              assignmentId,
              parcelId: p.id,
              riderId: rider.id,
              result: data.result,
              photoAssetId: assetId,
              idempotencyKey: data.idempotencyKey,
            },
          });
          if (assetId) {
            const changed = await tx.photoAsset.updateMany({
              where: {
                id: assetId,
                uploaderId: user.id,
                parcelId: p.id,
                assignmentId,
                lifecycle: "STAGED",
              },
              data: { lifecycle: "ATTACHED" },
            });
            invariant(changed.count === 1, 409, "Photo cannot be attached.");
          }
          await tx.assignment.update({
            where: { id: assignmentId },
            data: {
              latestResult: data.result,
              lifecycle: status === "DELIVERED" ? "COMPLETED" : "ACTIVE",
              endedAt: status === "DELIVERED" ? new Date() : null,
              version: { increment: 1 },
            },
          });
          await tx.parcel.update({
            where: { id: p.id },
            data: {
              customerStatus: status,
              deliveredAt: status === "DELIVERED" ? new Date() : null,
              version: { increment: 1 },
            },
          });
          await audit(tx, user.id, "DELIVERY_RESULT", p.id, {
            assignmentId,
            result: data.result,
            attemptId: attempt.id,
          });
          return { id: attempt.id };
        },
      ),
    );
  } finally {
    // Includes duplicate racing submissions: their unused staged object remains eligible for cleanup.
    if (assetId)
      await getDb().photoAsset.updateMany({
        where: { id: assetId, lifecycle: "STAGED" },
        data: { lifecycle: "DELETE_PENDING" },
      });
  }
}
export async function cleanupPhotos() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const staged = await getDb().photoAsset.findMany({
    where: {
      lifecycle: { in: ["STAGED", "DELETE_PENDING"] },
      createdAt: { lt: cutoff },
      attempt: null,
    },
    take: 100,
  });
  let removed = 0;
  for (const asset of staged) {
    // Claim before object deletion. Attachment only accepts STAGED, so it cannot race cleanup.
    const claim = await getDb().photoAsset.updateMany({
      where: {
        id: asset.id,
        lifecycle: { in: ["STAGED", "DELETE_PENDING"] },
        createdAt: { lt: cutoff },
        attempt: null,
      },
      data: { lifecycle: "DELETE_PENDING" },
    });
    if (!claim.count) continue;
    await getPrivateStore().remove(asset.storageKey);
    await getDb().photoAsset.deleteMany({
      where: { id: asset.id, lifecycle: { not: "ATTACHED" }, attempt: null },
    });
    removed++;
  }
  return removed;
}
