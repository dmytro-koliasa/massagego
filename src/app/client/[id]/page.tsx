import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth/client";
import { userHasPortal } from "@/lib/portals.server";
import { parseMassageTypes } from "@/lib/massage-types";
import { prisma } from "@/lib/prisma";
import { MasseurBookingView } from "@/components/masseur-booking-view";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function MasseurBookingPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/client");
  }

  const allowed = await userHasPortal(session.user.id, "client");
  if (!allowed) {
    redirect("/client");
  }

  const { id } = await params;

  const masseur = await prisma.user.findFirst({
    where: {
      id,
      portal: "masseur",
    },
    select: {
      id: true,
      nameEn: true,
      nameUk: true,
      image: true,
      descriptionEn: true,
      descriptionUk: true,
      massageTypes: true,
      city: true,
      address: true,
      galleryImages: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          url: true,
          width: true,
          height: true,
        },
      },
    },
  });

  if (!masseur) {
    notFound();
  }

  const { galleryImages, ...profile } = masseur;

  return (
    <MasseurBookingView
      masseur={{
        ...profile,
        massageTypes: parseMassageTypes(profile.massageTypes),
        galleryImages,
      }}
    />
  );
}
