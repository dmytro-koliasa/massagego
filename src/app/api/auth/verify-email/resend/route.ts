import { NextResponse } from "next/server";
import { createAndSendVerificationLink } from "@/lib/email/verification";
import type { Locale } from "@/lib/i18n";
import { requirePortalUser } from "@/lib/notifications/portal-gate";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const gate = await requirePortalUser();
  if (!gate.ok) return gate.response;

  const user = await prisma.user.findUnique({
    where: { id: gate.userId },
    select: {
      email: true,
      emailVerified: true,
      preferredLocale: true,
      portal: true,
    },
  });
  if (!user || user.portal !== gate.portal) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (user.emailVerified) {
    return NextResponse.json({ error: "already_verified" }, { status: 400 });
  }

  const locale = (user.preferredLocale === "uk" ? "uk" : "en") as Locale;
  const result = await createAndSendVerificationLink({
    userId: gate.userId,
    email: user.email,
    locale,
  });

  if (!result.ok) {
    const status =
      result.error === "resend_too_soon" || result.error === "resend_limit"
        ? 429
        : 400;
    return NextResponse.json(
      { error: result.error, retryAfterSec: result.retryAfterSec },
      { status },
    );
  }

  return NextResponse.json({ ok: true });
}
