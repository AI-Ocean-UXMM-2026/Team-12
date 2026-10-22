import { requirePageRole } from "@/server/page-auth";
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePageRole("ADMIN");
  return children;
}
