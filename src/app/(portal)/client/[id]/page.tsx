import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
};

/** Legacy URL `/client/[id]` → `/client/masseur/[slug]`. */
export default async function LegacyMasseurBookingRedirect({ params }: PageProps) {
  const { id } = await params;
  const masseur = await prisma.user.findFirst({
    where: { portal: "masseur", OR: [{ id }, { slug: id }] },
    select: { slug: true, id: true },
  });

  if (masseur?.slug) {
    redirect(`/client/masseur/${masseur.slug}`);
  }

  redirect(`/client/masseur/${id}`);
}
