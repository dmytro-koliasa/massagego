import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth/masseur";
import { userHasPortal } from "@/lib/portals.server";
import { parseMassageTypes } from "@/lib/massage-types";
import { portalHomePath } from "@/lib/portals";
import { prisma } from "@/lib/prisma";
import { DashboardView } from "@/components/masseur-dashboard";

export default async function MasseurDashboardPage() {
  const session = await auth();
  const loginPath = portalHomePath("masseur");

  if (!session?.user?.id) {
    redirect(loginPath);
  }

  const allowed = await userHasPortal(session.user.id, "masseur");
  if (!allowed) {
    redirect(loginPath);
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
      emailVerified: true,
      phone: true,
      image: true,
      descriptionEn: true,
      descriptionUk: true,
      massageTypes: true,
      city: true,
      cityPlaceId: true,
      cityCountryCode: true,
      cityNameEn: true,
      cityNameUk: true,
      cityLat: true,
      cityLon: true,
      address: true,
      timezone: true,
      preferredLocale: true,
      bookingLeadHours: true,
      cancelCutoffHours: true,
      reminderHours: true,
    },
  });

  if (!profile) {
    await signOut({ redirectTo: loginPath });
  }

  return (
    <DashboardView
      profile={{
        ...profile!,
        emailVerified: Boolean(profile!.emailVerified),
        massageTypes: parseMassageTypes(profile!.massageTypes),
      }}
    />
  );
}
