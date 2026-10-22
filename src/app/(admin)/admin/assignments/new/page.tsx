import { AppShell } from "@/components/app-shell";
import { AssignmentCreate } from "@/components/workflows";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ parcel?: string }>;
}) {
  return (
    <AppShell title="Manage assignment">
      <AssignmentCreate parcelId={(await searchParams).parcel} />
    </AppShell>
  );
}
