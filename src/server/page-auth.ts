import { redirect } from "next/navigation";
import { actor } from "./security";
import { AppError } from "./errors";
export async function requirePageUser() {
  try {
    const user = await actor(undefined, true);
    if (user.mustChangePassword) redirect("/setup");
    return user;
  } catch (error) {
    if (error instanceof AppError && error.status === 401) redirect("/login");
    throw error;
  }
}
export async function requirePageRole(role:"ADMIN"|"RIDER") {
  const user=await requirePageUser();
  if(user.role!==role)redirect(user.role==="ADMIN"?"/admin/parcels":"/rider/assignments");
  return user;
}
