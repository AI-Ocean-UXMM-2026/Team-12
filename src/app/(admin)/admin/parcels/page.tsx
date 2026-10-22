import { AppShell } from "@/components/app-shell";
import { Listing } from "@/components/workflows";
export default function Page() {
  return (
    <AppShell title="parcels">
      <Listing kind="parcels" />
    </AppShell>
  );
}
