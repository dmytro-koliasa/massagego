import { NextResponse } from "next/server";
import { consumeVerificationToken } from "@/lib/email/verification";
import { portalDefaultCallback, portalHomePath } from "@/lib/portals";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim() ?? "";
  const origin = new URL(request.url).origin;

  if (!token) {
    return NextResponse.redirect(`${origin}/client?emailVerified=missing`);
  }

  const result = await consumeVerificationToken(token);
  if (!result.ok) {
    return NextResponse.redirect(`${origin}/client?emailVerified=invalid`);
  }

  const user = await prisma.user.findUnique({
    where: { id: result.userId },
    select: { portal: true },
  });

  if (user?.portal === "masseur") {
    return NextResponse.redirect(
      `${origin}${portalDefaultCallback("masseur")}?emailVerified=ok`,
    );
  }
  if (user?.portal === "client") {
    return NextResponse.redirect(`${origin}/client?emailVerified=ok`);
  }

  return NextResponse.redirect(
    `${origin}${portalHomePath("client")}?emailVerified=ok`,
  );
}
