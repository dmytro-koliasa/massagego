import { redirect } from "next/navigation";
import { auth } from "@/auth/client";
import { ClientMasseursView } from "@/components/client-masseurs-view";
import { portalHomePath } from "@/lib/portals";

export default async function ClientEntryPage() {
  const session = await auth();
  if (!session?.user?.id || session.user.portal !== "client") {
    redirect(portalHomePath("client"));
  }

  return <ClientMasseursView />;
}
