import { AppShell } from "@/components/app-shell";
import { AssignmentDetail } from "@/components/workflows";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <AppShell title="Details">
      <AssignmentDetail id={(await params).id} />
    </AppShell>
  );
}
