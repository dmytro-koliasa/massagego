import { AdminShell } from "@/components/admin-shell";
import { AdminUsersPanel } from "@/components/admin-users-panel";

export default function AdminHomePage() {
  return (
    <AdminShell>
      <AdminUsersPanel />
    </AdminShell>
  );
}
