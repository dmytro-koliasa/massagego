import "server-only";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-session.server";
import { portalHomePath } from "@/lib/portals";

/** Server pages: stale/missing admin session → login (#137). */
export async function requireAdminPage(): Promise<{ userId: string }> {
  const gate = await requireAdmin();
  if (!gate.ok) {
    redirect(`${portalHomePath("admin")}?error=session`);
  }
  return { userId: gate.userId };
}
