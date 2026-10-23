import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getPrivateStore } from "@/lib/storage";
import { actor, rateLimit } from "@/server/security";
import { invariant } from "@/server/errors";
import { resultSchema } from "@/lib/validation/workflows";
import { submitResult } from "./photos";

export async function createPhotoUpload(assignmentId: string, input: unknown) {
  const user = await actor("RIDER");
  await rateLimit(`photo-ticket:${user.id}`, 20);
  const { idempotencyKey } = z.object({ idempotencyKey: z.string().min(16).max(128) }).strict().parse(input);
  // Local setups keep the original multipart path; production uses direct Blob uploads.
  if (process.env.STORAGE_ADAPTER !== "vercel-blob") return { mode: "multipart" as const };
  const assignment = await getDb().assignment.findFirst({ where: {
    id: assignmentId, riderId: user.rider!.id, lifecycle: "ACTIVE",
    parcel: { currentAssignmentId: assignmentId, customerStatus: { not: "DELIVERED" } },
  } });
  invariant(assignment, 404, "Assignment unavailable.");
  const id = randomUUID();
  const ticket = await getDb().photoUploadTicket.create({ data: {
    id, userId: user.id, assignmentId, idempotencyKey,
    storageKey: `staging/${id}`, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  } });
  return { mode: "blob" as const, id, pathname: ticket.storageKey };
}

export async function authorizeBlobToken(pathname: string, clientPayload: string | null) {
  const user = await actor("RIDER");
  await rateLimit(`photo-token:${user.id}`, 20);
  const { ticketId } = z.object({ ticketId: z.uuid() }).strict().parse(JSON.parse(clientPayload ?? "{}"));
  const ticket = await getDb().photoUploadTicket.findFirst({ where: { id: ticketId, userId: user.id } });
  invariant(ticket && ticket.storageKey === pathname, 404, "Upload unavailable.");
  const validUntil = ticket.createdAt.getTime() + 15 * 60 * 1000;
  invariant(validUntil > Date.now(), 410, "Upload expired. Submit again.");
  const assignment = await getDb().assignment.findFirst({ where: {
    id: ticket.assignmentId, riderId: user.rider!.id, lifecycle: "ACTIVE",
    parcel: { currentAssignmentId: ticket.assignmentId, customerStatus: { not: "DELIVERED" } },
  } });
  invariant(assignment, 404, "Assignment unavailable.");
  return {
    allowedContentTypes: ["image/jpeg", "image/png"], maximumSizeInBytes: 10485760,
    validUntil, addRandomSuffix: false, allowOverwrite: false,
  };
}

export async function submitBlobResult(assignmentId: string, input: unknown) {
  const user = await actor("RIDER");
  const data = resultSchema.extend({ uploadId: z.uuid().optional() }).strict().parse(input);
  const form = new FormData();
  form.set("result", data.result);
  form.set("version", String(data.version));
  form.set("idempotencyKey", data.idempotencyKey);
  if (data.uploadId) {
    invariant(process.env.STORAGE_ADAPTER === "vercel-blob", 422, "Direct upload unavailable.");
    const ticket = await getDb().photoUploadTicket.findFirst({ where: {
      id: data.uploadId, userId: user.id, assignmentId,
      idempotencyKey: data.idempotencyKey, expiresAt: { gt: new Date() },
    } });
    invariant(ticket, 404, "Upload unavailable or expired.");
    // Recheck current ownership before fetching bytes, including after reassignment/revocation.
    const assignment = await getDb().assignment.findFirst({ where: {
      id: assignmentId, riderId: user.rider!.id, parcel: { currentAssignmentId: assignmentId },
    } });
    invariant(assignment, 404, "Assignment unavailable.");
    const bytes = await getPrivateStore().get(ticket.storageKey);
    form.set("photo", new File([new Uint8Array(bytes)], "proof", { type: "application/octet-stream" }));
  }
  // The existing service decodes/re-encodes the raw image, writes separate private proof,
  // and commits it with ownership/version/idempotency checks in one DB transaction.
  return submitResult(assignmentId, form);
}

export async function cleanupBlobUploads() {
  if (process.env.STORAGE_ADAPTER !== "vercel-blob") return 0;
  const tickets = await getDb().photoUploadTicket.findMany({
    where: { expiresAt: { lt: new Date() } }, take: 100, orderBy: { expiresAt: "asc" },
  });
  for (const ticket of tickets) {
    await getPrivateStore().remove(ticket.storageKey);
    await getDb().photoUploadTicket.deleteMany({ where: { id: ticket.id } });
  }
  return tickets.length;
}
