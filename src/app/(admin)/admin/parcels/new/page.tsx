import { AppShell } from "@/components/app-shell";
import { ParcelCreate } from "@/components/workflows";
export default function Page() {
  return (
    <AppShell title="Create parcel">
      <ParcelCreate />
    </AppShell>
  );
}
