import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { checkOrigin } from "@/server/security";
import { invariant } from "@/server/errors";
import { endpoint } from "@/server/http";
import { authorizeBlobToken } from "@/server/services/blob-uploads";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    invariant(process.env.STORAGE_ADAPTER === "vercel-blob", 404, "Upload unavailable.");
    const body = await request.json() as HandleUploadBody;
    // No webhook changes delivery state. Finalization is an authenticated separate request.
    invariant(body.type === "blob.generate-client-token", 400, "Invalid upload request.");
    return Response.json(await handleUpload({ request, body, onBeforeGenerateToken: authorizeBlobToken }),
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return endpoint(async () => { throw error; }); }
}
