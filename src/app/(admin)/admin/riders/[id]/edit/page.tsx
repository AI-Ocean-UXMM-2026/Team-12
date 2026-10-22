import { AppShell } from "@/components/app-shell";
import { RiderEditor } from "@/components/workflows";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <AppShell title="Details">
      <RiderEditor id={(await params).id} />
    </AppShell>
  );
}
