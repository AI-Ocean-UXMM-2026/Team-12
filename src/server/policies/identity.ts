import "server-only";
export type Actor = { userId: string; role: "ADMIN" | "RIDER"; riderId?: string };
/** Fail closed until a maintained auth library's session verifier is wired in.
 * Do not replace this with browser-supplied IDs, cookies that aren't verified,
 * a development default user, or a role passed in request headers.
 */
export async function requireActor(): Promise<Actor> {
  throw new Error("Authentication is not implemented. Operational access is denied.");
}
