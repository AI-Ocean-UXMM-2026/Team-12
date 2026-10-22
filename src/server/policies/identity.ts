import "server-only";
import { actor } from "@/server/security";
export type Actor = {
  userId: string;
  role: "ADMIN" | "RIDER";
  riderId?: string;
};
/** Derive the actor from the verified database session and current account state.
 * Never accept an actor or role from browser-supplied identifiers or headers.
 */
export async function requireActor(): Promise<Actor> {
  const user = await actor();
  return { userId: user.id, role: user.role, riderId: user.rider?.id };
}
