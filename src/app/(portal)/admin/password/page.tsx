import { AdminPasswordForm } from "@/components/admin-password-form";
import { AdminShell } from "@/components/admin-shell";
import { requireAdminPage } from "@/lib/admin-guard.server";

export default async function AdminPasswordPage() {
  await requireAdminPage();
  return (
    <AdminShell>
      <AdminPasswordForm />
    </AdminShell>
  );
}
