import { timingSafeEqual } from "node:crypto";
import { cleanupPhotos } from "@/server/services/photos";
import { cleanupBlobUploads } from "@/server/services/blob-uploads";
import { endpoint } from "@/server/http";

export const maxDuration = 60;
export async function GET(request: Request) {
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  const supplied = request.headers.get("authorization") ?? "";
  if (!process.env.CRON_SECRET || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected)))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  return endpoint(async () => ({ photos: await cleanupPhotos(), uploads: await cleanupBlobUploads() }));
}
