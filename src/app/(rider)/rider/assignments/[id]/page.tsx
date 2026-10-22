import { RiderShell } from "@/components/portal-shells";
import { AssignmentDetail } from "@/components/workflows";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <RiderShell title="Delivery details">
      <AssignmentDetail id={(await params).id} rider />
    </RiderShell>
  );
}
