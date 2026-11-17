import { NextResponse } from "next/server";
import { requireClientSession } from "@/lib/client-session.server";
import { createAndSendVerificationLink } from "@/lib/email/verification";
import { prisma } from "@/lib/prisma";
import type { Locale } from "@/lib/i18n";

export async function POST(request: Request) {
  const client = await requireClientSession();
  if (!client.ok) {
    return NextResponse.json(
      { error: client.status === 401 ? "unauthorized" : "forbidden" },
      { status: client.status },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: client.userId },
    select: {
      email: true,
      emailVerified: true,
      preferredLocale: true,
    },
  });
  if (!user) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (user.emailVerified) {
    return NextResponse.json({ error: "already_verified" }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const locale = (user.preferredLocale === "uk" ? "uk" : "en") as Locale;
  const result = await createAndSendVerificationLink({
    userId: client.userId,
    email: user.email,
    origin,
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
