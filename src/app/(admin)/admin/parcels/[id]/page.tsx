import { AppShell } from "@/components/app-shell";
import { ParcelDetail } from "@/components/workflows";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <AppShell title="Details">
      <ParcelDetail id={(await params).id} />
    </AppShell>
  );
}
