import { getAuth } from "@/lib/auth";
import { checkOrigin, requestRateLimit } from "@/server/security";
import { endpoint } from "@/server/http";
export async function GET(request: Request) {
  return getAuth().handler(request);
}
export async function POST(request: Request) {
  const guarded = await endpoint(async () => {
    checkOrigin(request);
    await requestRateLimit(request, "auth", 60);
  });
  if (!guarded.ok) return guarded;
  return getAuth().handler(request);
}
