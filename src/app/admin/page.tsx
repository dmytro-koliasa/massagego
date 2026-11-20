import { AdminShell } from "@/components/admin-shell";
import { AdminUsersPanel } from "@/components/admin-users-panel";
import { requireAdminPage } from "@/lib/admin-guard.server";

export default async function AdminHomePage() {
  await requireAdminPage();
  return (
    <AdminShell>
      <AdminUsersPanel />
    </AdminShell>
  );
}
