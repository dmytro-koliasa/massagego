import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-session.server";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await context.params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      portal: true,
      email: true,
      emailVerified: true,
      phone: true,
      phoneConfirmedAt: true,
      name: true,
      nameEn: true,
      nameUk: true,
      slug: true,
      image: true,
      descriptionEn: true,
      descriptionUk: true,
      city: true,
      cityPlaceId: true,
      cityCountryCode: true,
      cityNameEn: true,
      cityNameUk: true,
      address: true,
      timezone: true,
      preferredLocale: true,
      bookingLeadHours: true,
      cancelCutoffHours: true,
      telegramChatId: true,
      telegramLinkedAt: true,
      blockedAt: true,
      deletedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ user });
}
