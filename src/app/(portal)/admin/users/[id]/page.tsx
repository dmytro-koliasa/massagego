import { AdminShell } from "@/components/admin-shell";
import { AdminUserDetail } from "@/components/admin-user-detail";
import { requireAdminPage } from "@/lib/admin-guard.server";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminUserPage({ params }: PageProps) {
  await requireAdminPage();
  const { id } = await params;
  return (
    <AdminShell>
      <AdminUserDetail userId={id} />
    </AdminShell>
  );
}
