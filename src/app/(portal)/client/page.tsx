import { redirect } from "next/navigation";
import { auth } from "@/auth/client";
import { ClientMasseursView } from "@/components/client-masseurs-view";
import { portalHomePath } from "@/lib/portals";
import { userHasPortal } from "@/lib/portals.server";

export default async function ClientEntryPage() {
  const session = await auth();
  const loginPath = portalHomePath("client");
  if (!session?.user?.id || session.user.portal !== "client") {
    redirect(loginPath);
  }

  const allowed = await userHasPortal(session.user.id, "client");
  if (!allowed) {
    redirect(loginPath);
  }

  return <ClientMasseursView />;
}
