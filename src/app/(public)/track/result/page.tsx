import { CustomerShell } from "@/components/portal-shells";
import { Tracking } from "@/components/workflows";
export default function Page() {
  return (
    <CustomerShell title="Your delivery">
      <Tracking result />
    </CustomerShell>
  );
}
