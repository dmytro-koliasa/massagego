import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth/masseur";
import { userHasPortal } from "@/lib/portals.server";
import { parseMassageTypes } from "@/lib/massage-types";
import { prisma } from "@/lib/prisma";
import { DashboardView } from "@/components/masseur-dashboard";

export default async function MasseurDashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/masseur");
  }

  const allowed = await userHasPortal(session.user.id, "masseur");
  if (!allowed) {
    redirect("/masseur");
  }

  const profile = await prisma.user.findUnique({
    where: { id: session.user.id },
      select: {
      id: true,
      name: true,
      nameEn: true,
      nameUk: true,
      slug: true,
      email: true,
      image: true,
      descriptionEn: true,
      descriptionUk: true,
      massageTypes: true,
      city: true,
      address: true,
    },
  });

  if (!profile) {
    await signOut({ redirectTo: "/masseur" });
  }

  return (
    <DashboardView
      profile={{
        ...profile!,
        massageTypes: parseMassageTypes(profile!.massageTypes),
      }}
    />
  );
}
