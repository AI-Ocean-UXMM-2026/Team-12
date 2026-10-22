import { getDb } from "@/lib/db";
import { getPrivateStore } from "@/lib/storage";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await getDb().$queryRaw`SELECT 1`;
    await getPrivateStore().ready();
    return Response.json(
      { ready: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { ready: false },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
