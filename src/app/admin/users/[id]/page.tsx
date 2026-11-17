import { AdminShell } from "@/components/admin-shell";
import { AdminUserDetail } from "@/components/admin-user-detail";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminUserPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <AdminShell>
      <AdminUserDetail userId={id} />
    </AdminShell>
  );
}
