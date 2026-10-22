import { RiderShell } from "@/components/portal-shells";
import { Listing } from "@/components/workflows";
import { businessToday } from "@/lib/dates";
export default function Page() {
  return (
    <RiderShell title="My Deliveries">
      <Listing kind="assignments" rider initialDate={businessToday()} />
    </RiderShell>
  );
}
