import { StaffAuthShell } from "@/components/portal-shells";
import { Login } from "@/components/workflows";
export default function Page() {
  return (
    <StaffAuthShell title="Staff sign in">
      <Login />
    </StaffAuthShell>
  );
}
