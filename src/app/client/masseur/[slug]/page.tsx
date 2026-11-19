import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth/client";
import { isMasseurListed } from "@/lib/masseur-catalog";
import { portalHomePath } from "@/lib/portals";
import { userHasPortal } from "@/lib/portals.server";
import { parseMassageTypes } from "@/lib/massage-types";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MasseurBookingView } from "@/components/masseur-booking-view";

type PageProps = {
  params: Promise<{ slug: string }>;
};

const masseurSelect = {
  id: true,
  slug: true,
  nameEn: true,
  nameUk: true,
  image: true,
  descriptionEn: true,
  descriptionUk: true,
  massageTypes: true,
  city: true,
  cityPlaceId: true,
  address: true,
  phone: true,
  emailVerified: true,
  galleryImages: {
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      url: true,
      width: true,
      height: true,
    },
  },
  _count: { select: { availabilitySlots: true } },
} satisfies Prisma.UserSelect;

export default async function MasseurBookingPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(portalHomePath("client"));
  }

  const allowed = await userHasPortal(session.user.id, "client");
  if (!allowed) {
    redirect(portalHomePath("client"));
  }

  const { slug } = await params;

  const masseur =
    (await prisma.user.findFirst({
      where: { portal: "masseur", slug },
      select: masseurSelect,
    })) ??
    // Back-compat: old cuid links still open the profile.
    (await prisma.user.findFirst({
      where: { portal: "masseur", id: slug },
      select: masseurSelect,
    }));

  if (!masseur) {
    notFound();
  }

  // Prefer the canonical slug URL when opened via id.
  if (masseur.slug && masseur.slug !== slug) {
    redirect(`/client/masseur/${masseur.slug}`);
  }

  const { galleryImages, _count, cityPlaceId, phone, emailVerified, ...profile } =
    masseur;
  const listed = isMasseurListed({
    nameEn: masseur.nameEn,
    nameUk: masseur.nameUk,
    cityPlaceId,
    address: masseur.address,
    phone,
    emailVerified,
    _count,
  });

  const clientUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      nameEn: true,
      nameUk: true,
      phone: true,
    },
  });

  return (
    <MasseurBookingView
      masseur={{
        ...profile,
        massageTypes: parseMassageTypes(profile.massageTypes),
        galleryImages,
      }}
      listed={listed}
      clientProfile={{
        name: clientUser?.name ?? null,
        nameEn: clientUser?.nameEn ?? null,
        nameUk: clientUser?.nameUk ?? null,
        phone: clientUser?.phone ?? null,
      }}
    />
  );
}
