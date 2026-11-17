import { ensureAdminBootstrap } from "@/lib/admin-bootstrap";
import { AdminLoginClient } from "@/components/admin-login-client";

export default async function AdminLoginPage() {
  await ensureAdminBootstrap();
  return <AdminLoginClient />;
}
