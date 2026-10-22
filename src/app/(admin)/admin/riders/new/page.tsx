import { AppShell } from "@/components/app-shell";
import { RiderEditor } from "@/components/workflows";
export default function Page() {
  return (
    <AppShell title="Create Rider">
      <RiderEditor />
    </AppShell>
  );
}
