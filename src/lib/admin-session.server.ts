import "server-only";
import { NextResponse } from "next/server";
import { auth as adminAuth } from "@/auth/admin";
import { prisma } from "@/lib/prisma";

export async function requireAdmin(): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
> {
  const session = await adminAuth();
  const userId = session?.user?.id;
  if (!userId || session.user?.portal !== "admin") {
    return {
      ok: false,
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, portal: "admin", deletedAt: null, blockedAt: null },
    select: { id: true },
  });
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }

  return { ok: true, userId: user.id };
}
