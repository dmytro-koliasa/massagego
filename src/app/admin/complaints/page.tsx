import { AdminComplaintsPanel } from "@/components/admin-complaints-panel";
import { AdminShell } from "@/components/admin-shell";
import { requireAdminPage } from "@/lib/admin-guard.server";

export default async function AdminComplaintsPage() {
  await requireAdminPage();
  return (
    <AdminShell>
      <AdminComplaintsPanel />
    </AdminShell>
  );
}
