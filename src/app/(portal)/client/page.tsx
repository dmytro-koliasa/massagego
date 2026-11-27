import { redirect } from "next/navigation";
import { auth } from "@/auth/client";
import { ClientMasseursView } from "@/components/client-masseurs-view";
import { parseCatalogSearchParams } from "@/lib/catalog-url";
import {
  queryMasseurCatalog,
  serializeMasseurCatalog,
} from "@/lib/masseur-catalog-query";
import { portalHomePath } from "@/lib/portals";
import { userHasPortal } from "@/lib/portals.server";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ClientEntryPage({ searchParams }: PageProps) {
  const session = await auth();
  const loginPath = portalHomePath("client");
  if (!session?.user?.id || session.user.portal !== "client") {
    redirect(loginPath);
  }

  const allowed = await userHasPortal(session.user.id, "client");
  if (!allowed) {
    redirect(loginPath);
  }

  const params = parseCatalogSearchParams(await searchParams);
  const catalog = serializeMasseurCatalog(
    await queryMasseurCatalog({
      clientUserId: session.user.id,
      city: params.city,
      page: params.page,
    }),
  );

  return <ClientMasseursView initialCatalog={catalog} />;
}
