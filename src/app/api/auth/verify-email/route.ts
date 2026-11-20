import { NextResponse } from "next/server";
import {
  buildTrustedAppUrl,
  resolveTrustedAppOrigin,
} from "@/lib/auth/trusted-origin";
import { consumeVerificationToken } from "@/lib/email/verification";
import { portalDefaultCallback, portalHomePath } from "@/lib/portals";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const trusted = resolveTrustedAppOrigin();
  if (!trusted.ok) {
    return NextResponse.json(
      { error: "auth_url_missing" },
      { status: 503 },
    );
  }

  const token = new URL(request.url).searchParams.get("token")?.trim() ?? "";
  const origin = trusted.origin;

  if (!token) {
    return NextResponse.redirect(
      buildTrustedAppUrl(origin, "/client?emailVerified=missing"),
    );
  }

  const result = await consumeVerificationToken(token);
  if (!result.ok) {
    return NextResponse.redirect(
      buildTrustedAppUrl(origin, "/client?emailVerified=invalid"),
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: result.userId },
    select: { portal: true },
  });

  if (user?.portal === "masseur") {
    return NextResponse.redirect(
      buildTrustedAppUrl(
        origin,
        `${portalDefaultCallback("masseur")}?emailVerified=ok`,
      ),
    );
  }
  if (user?.portal === "client") {
    return NextResponse.redirect(
      buildTrustedAppUrl(origin, "/client?emailVerified=ok"),
    );
  }

  return NextResponse.redirect(
    buildTrustedAppUrl(
      origin,
      `${portalHomePath("client")}?emailVerified=ok`,
    ),
  );
}
