export const dynamic = "force-dynamic";
export function GET() {
  // Liveness only; this must not be represented as DB/storage readiness.
  return Response.json(
    { status: "ok", stage: "scaffold", check: "liveness" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
