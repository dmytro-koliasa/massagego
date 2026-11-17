import "server-only";
import { NextResponse } from "next/server";
import { auth as clientAuth } from "@/auth/client";
import { auth as masseurAuth } from "@/auth/masseur";
import { prisma } from "@/lib/prisma";

export async function requirePortalUser(): Promise<
  | { ok: true; userId: string; portal: "client" | "masseur" }
  | { ok: false; response: NextResponse }
> {
  const [clientSession, masseurSession] = await Promise.all([
    clientAuth(),
    masseurAuth(),
  ]);

  const clientId = clientSession?.user?.id;
  const masseurId = masseurSession?.user?.id;

  if (clientId) {
    const user = await prisma.user.findUnique({
      where: { id: clientId },
      select: { portal: true, deletedAt: true },
    });
    if (user?.portal === "client" && !user.deletedAt) {
      return { ok: true, userId: clientId, portal: "client" };
    }
  }

  if (masseurId) {
    const user = await prisma.user.findUnique({
      where: { id: masseurId },
      select: { portal: true, deletedAt: true },
    });
    if (user?.portal === "masseur" && !user.deletedAt) {
      return { ok: true, userId: masseurId, portal: "masseur" };
    }
  }

  return {
    ok: false,
    response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
  };
}
