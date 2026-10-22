import { requirePageUser } from "@/server/page-auth";
import {StaffAuthShell} from "@/components/portal-shells";
import {SignOut} from "@/components/workflows";
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user=await requirePageUser();
  if(user.role!=="RIDER")return <StaffAuthShell title="Rider account required"><p className="mb-5">Sign in with a Rider account to view your assigned deliveries.</p><SignOut label="Sign in as a Rider"/></StaffAuthShell>;
  return children;
}
