import "server-only";
import { cookies, headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { digest } from "@/lib/crypto";
import { invariant } from "./errors";
export async function actor(role?: "ADMIN" | "RIDER", allowSetup = false) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  invariant(session, 401, "Please sign in.");
  const user = await getDb().user.findUnique({
    where: { id: session.user.id },
    include: { rider: true },
  });
  invariant(user?.active, 401, "Account is unavailable.");
  invariant(
    !user.mustChangePassword || allowSetup,
    403,
    "Change your setup password before continuing.",
  );
  invariant(
    !role || user.role === role,
    403,
    "You do not have access to this workspace.",
  );
  if (user.role === "RIDER")
    invariant(user.rider?.active, 403, "Rider account is unavailable.");
  return user;
}
export async function trackingScope() {
  const value = (await cookies()).get("parcel-tracking")?.value;
  invariant(value, 401, "Enter your parcel code again.");
  const session = await getDb().trackingSession.findUnique({
    where: { id: digest(value) },
  });
  invariant(
    session && session.expiresAt > new Date(),
    401,
    "Tracking session expired. Enter your parcel code again.",
  );
  return session.parcelId;
}
export function checkOrigin(request: Request) {
  invariant(
    request.headers.get("origin") ===
      new URL(process.env.APP_BASE_URL ?? "http://localhost:3000").origin,
    403,
    "Request origin is not permitted.",
  );
}
export async function rateLimit(
  identity: string,
  limit: number,
  windowSeconds = 60,
) {
  const id = digest(identity);
  const rows = await getDb().$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("id","count","resetAt") VALUES (${id},1,NOW()+${windowSeconds}*INTERVAL '1 second')
    ON CONFLICT ("id") DO UPDATE SET "count" = CASE WHEN "RateLimit"."resetAt" < NOW() THEN 1 ELSE "RateLimit"."count"+1 END,
    "resetAt" = CASE WHEN "RateLimit"."resetAt" < NOW() THEN NOW()+${windowSeconds}*INTERVAL '1 second' ELSE "RateLimit"."resetAt" END RETURNING "count"`;
  invariant(
    rows[0].count <= limit,
    429,
    "Too many requests. Try again shortly.",
  );
}
export async function requestRateLimit(
  request: Request,
  bucket: string,
  limit: number,
) {
  // Only trust forwarded IPs when deployment explicitly puts the app behind a trusted proxy.
  const identity =
    process.env.TRUST_PROXY === "true"
      ? (request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        "unknown")
      : "local";
  await rateLimit(`${bucket}:${identity}`, limit);
}
