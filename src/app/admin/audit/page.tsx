import { AdminAuditPanel } from "@/components/admin-audit-panel";
import { AdminShell } from "@/components/admin-shell";
import { requireAdminPage } from "@/lib/admin-guard.server";

export default async function AdminAuditPage() {
  await requireAdminPage();
  return (
    <AdminShell>
      <AdminAuditPanel />
    </AdminShell>
  );
}
