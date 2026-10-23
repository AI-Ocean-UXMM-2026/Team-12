import { cookies, headers } from "next/headers";
import {businessToday} from "@/lib/dates";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { getPrivateStore } from "@/lib/storage";
import { digest, token } from "@/lib/crypto";
import {
  actor,
  checkOrigin,
  rateLimit,
  requestRateLimit,
  trackingScope,
} from "@/server/security";
import { invariant } from "@/server/errors";
import { endpoint } from "@/server/http";
import {
  assignParcel,
  createParcel,
  saveRider,
  trackingView,
  updatePreferences,
} from "@/server/services/operations";
import { submitResult } from "@/server/services/photos";
import { createPhotoUpload, submitBlobResult } from "@/server/services/blob-uploads";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
type Context = { params: Promise<{ path: string[] }> };
async function boundedForm(request: Request) {
  const reader = request.body?.getReader();
  invariant(reader, 422, "Upload body is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > 11534336) {
      await reader.cancel();
      invariant(false, 413, "Upload is too large.");
    }
    chunks.push(part.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new Response(bytes, {
    headers: { "Content-Type": request.headers.get("content-type") ?? "" },
  }).formData();
}
export async function GET(request: Request, { params }: Context) {
  const { path } = await params;
  if (path[0] === "photos") {
    try {
      const user = await actor();
      const photo = await getDb().photoAsset.findUnique({
        where: { id: z.uuid().parse(path[1]) },
        include: { assignment: { include: { parcel: true } } },
      });
      invariant(
        photo?.lifecycle === "ATTACHED" &&
          (user.role === "ADMIN" ||
            (photo.assignment.riderId === user.rider?.id &&
              photo.assignment.parcel.currentAssignmentId ===
                photo.assignmentId)),
        404,
        "Photo unavailable.",
      );
      const bytes = await getPrivateStore().get(photo.storageKey);
      // Stream proof so valid images above 4.5 MB can be returned by Vercel Functions.
      return new Response(new ReadableStream({ start(controller) {
        for (let offset = 0; offset < bytes.length; offset += 65536)
          controller.enqueue(new Uint8Array(bytes.subarray(offset, offset + 65536)));
        controller.close();
      } }), {
        headers: {
          "Content-Type": photo.detectedMime,
          "Cache-Control": "private, no-store",
          "Content-Disposition": "inline; filename=delivery-proof.jpg",
        },
      });
    } catch (error) {
      return endpoint(async () => {
        throw error;
      });
    }
  }
  return endpoint(async () => {
    if (path.join("/") === "me") {
      const u = await actor(undefined, true);
      return {
        id: u.id,
        role: u.role,
        mustChangePassword: u.mustChangePassword,
      };
    }
    if (path.join("/") === "tracking")
      return trackingView(await trackingScope());
    const user = await actor(path[0] === "admin" ? "ADMIN" : "RIDER");
    const url = new URL(request.url);
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(100000)
      .parse(url.searchParams.get("page") ?? 1);
    const skip = (page - 1) * 25;
    const query = url.searchParams.get("code")?.slice(0, 64) ?? "";
    const date = url.searchParams.get("date");
    const deliveryDate = date ? new Date(z.iso.date().parse(date)) : undefined;
    if (path[0] === "admin" && path[1] === "riders") {
      if (path[2])
        return getDb().rider.findUniqueOrThrow({
          where: { id: z.uuid().parse(path[2]) },
          include: { user: { select: { email: true } } },
        });
      return getDb().rider.findMany({
        where: {
          name: {
            contains: url.searchParams.get("name") ?? "",
            mode: "insensitive",
          },
          contactNumber: { contains: url.searchParams.get("phone") ?? "" },
        },
        include: { user: { select: { email: true } } },
        orderBy: { name: "asc" },
        skip,
        take: 25,
      });
    }
    if (path[0] === "admin" && path[1] === "parcels") {
      if (path[2]) {
        const p = await getDb().parcel.findUniqueOrThrow({
          where: { id: z.uuid().parse(path[2]) },
          include: {
            assignments: {
              include: { rider: true, attempts: true },
              orderBy: { createdAt: "desc" },
            },
            currentAssignment: { include: { rider: true } },
          },
        });
        const {
          trackingCodeHash,
          trackingCodeCiphertext,
          trackingCodeNonce,
          ...safe
        } = p;
        void trackingCodeHash;
        void trackingCodeCiphertext;
        void trackingCodeNonce;
        return safe;
      }
      return getDb().parcel.findMany({
        where: {
          parcelCode: { contains: query, mode: "insensitive" },
          customerName: {
            contains: url.searchParams.get("customer") ?? "",
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          parcelCode: true,
          customerName: true,
          customerContactNumber: true,
          paymentType: true,
          customerStatus: true,
          version: true,
          currentAssignment: { select: { latestResult: true } },
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: 25,
      });
    }
    if (path[1] === "assignments") {
      const owner =
        user.role === "RIDER"
          ? {
              riderId: user.rider!.id,
              parcel: { currentAssignmentId: path[2] ?? undefined },
              lifecycle: {
                in: ["ACTIVE", "COMPLETED"] as ("ACTIVE" | "COMPLETED")[],
              },
            }
          : {};
      if (path[2]) {
        const a = await getDb().assignment.findFirst({
          where: { id: z.uuid().parse(path[2]), ...owner },
          include: {
            parcel: {
              select: {
                id: true,
                parcelCode: true,
                customerName: true,
                customerContactNumber: true,
                township: true,
                address: true,
                deliveryNote: true,
                receivingOption: true,
                deliveryInstruction: true,
                customerStatus: true,
                version: true,
                currentAssignmentId: true,
              },
            },
            rider: true,
            attempts: { orderBy: { submittedAt: "desc" } },
          },
        });
        invariant(a, 404, "Assignment unavailable.");
        return a;
      }
      return getDb().assignment.findMany({
        where: {
          ...owner,
          deliveryDate:deliveryDate??(user.role==="RIDER"?new Date(businessToday()):undefined),
          ...(url.searchParams.get("rider") && user.role === "ADMIN"
            ? { riderId: z.uuid().parse(url.searchParams.get("rider")) }
            : {}),
          parcel: {
            parcelCode: { contains: query, mode: "insensitive" },
            ...(user.role === "RIDER"
              ? { currentAssignmentId: { not: null } }
              : {}),
          },
        },
        include: {
          rider: { select: { name: true } },
          parcel: {
            select: {
              id: true,
              parcelCode: true,
              customerName: true,
              customerContactNumber: true,
              township: true,
              customerStatus: true,
              currentAssignmentId: true,
            },
          },
        },
        orderBy: [{ deliveryDate: "desc" }, { id: "asc" }],
        skip,
        take: 25,
      });
    }
    if (path[0] === "rider" && path[1] === "notifications") {
      const where = {
        riderId: user.rider!.id,
        deliveryDate,
        ...(query
          ? { snapshot: { path: ["parcelCode"], string_contains: query } }
          : {}),
      };
      return {
        items: await getDb().riderNotification.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: 25,
          skip,
        }),
        unread: await getDb().riderNotification.count({
          where: { riderId: user.rider!.id, readAt: null },
        }),
      };
    }
    invariant(false, 404, "Route unavailable.");
  });
}
async function write(request: Request, { params }: Context) {
  return endpoint(async () => {
    checkOrigin(request);
    const { path } = await params;
    const route = path.join("/");
    if (route === "tracking/exchange") {
      await requestRateLimit(request, "tracking", 30);
      const { code } = z
        .object({ code: z.string().trim().min(1).max(64) })
        .strict()
        .parse(await request.json());
      const p = await getDb().parcel.findUnique({
        where: { parcelCode: code },
        select: { id: true },
      });
      invariant(p, 404, "Parcel code is invalid or unavailable.");
      const value = token();
      await getDb().trackingSession.create({
        data: {
          id: digest(value),
          parcelId: p.id,
          expiresAt: new Date(Date.now() + 1800000),
        },
      });
      (await cookies()).set("parcel-tracking", value, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 1800,
      });
      return { ok: true };
    }
    if (route === "tracking/preferences") {
      const id = await trackingScope();
      await rateLimit(`preference:${id}`, 20);
      return updatePreferences(id, await request.json());
    }
    if (route === "tracking/clear") {
      const value = (await cookies()).get("parcel-tracking")?.value;
      if (value)
        await getDb().trackingSession.deleteMany({
          where: { id: digest(value) },
        });
      (await cookies()).delete("parcel-tracking");
      return { ok: true };
    }
    if (route === "password") {
      const user = await actor(undefined, true);
      const data = z
        .object({
          currentPassword: z.string().min(1),
          newPassword: z.string().min(12).max(128),
        })
        .strict()
        .parse(await request.json());
      invariant(
        data.currentPassword !== data.newPassword,
        422,
        "Choose a different password.",
      );
      await getAuth().api.changePassword({
        headers: await headers(),
        body: { ...data, revokeOtherSessions: true },
      });
      await getDb().user.update({
        where: { id: user.id },
        data: { mustChangePassword: false },
      });
      return { ok: true };
    }
    if (path[0] === "admin" && path[1] === "riders")
      return saveRider(
        await request.json(),
        path[2] ? z.uuid().parse(path[2]) : undefined,
      );
    if (route === "admin/parcels")
      return createParcel(
        await request.json(),
        request.headers.get("Idempotency-Key") ?? "",
      );
    if (route === "admin/assignments")
      return assignParcel(
        await request.json(),
        request.headers.get("Idempotency-Key") ?? "",
      );
    if (path[0] === "rider" && path[1] === "assignments" && path[3] === "photo-upload")
      return createPhotoUpload(z.uuid().parse(path[2]), await request.json());
    if (
      path[0] === "rider" &&
      path[1] === "assignments" &&
      path[3] === "results"
    ) {
      if (request.headers.get("content-type")?.includes("application/json"))
        return submitBlobResult(z.uuid().parse(path[2]), await request.json());
      invariant(
        Number(request.headers.get("content-length") ?? 0) <= 11534336,
        413,
        "Upload is too large.",
      );
      return submitResult(z.uuid().parse(path[2]), await boundedForm(request));
    }
    if (
      path[0] === "rider" &&
      path[1] === "notifications" &&
      path[3] === "read"
    ) {
      const user = await actor("RIDER");
      const updated = await getDb().riderNotification.updateMany({
        where: { id: z.uuid().parse(path[2]), riderId: user.rider!.id },
        data: { readAt: new Date() },
      });
      invariant(updated.count, 404, "Notification unavailable.");
      return { ok: true };
    }
    invariant(false, 404, "Route unavailable.");
  });
}
export const POST = write;
export const PATCH = write;
