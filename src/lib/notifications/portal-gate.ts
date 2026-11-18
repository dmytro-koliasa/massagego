import "server-only";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth as clientAuth } from "@/auth/client";
import { auth as masseurAuth } from "@/auth/masseur";
import { prisma } from "@/lib/prisma";
import {
  PORTAL_REQUEST_HEADER,
  isPublicPortal,
  type PublicPortal,
} from "@/lib/portals";

type GateOk = { ok: true; userId: string; portal: PublicPortal };
type GateFail = { ok: false; response: NextResponse };
type GateResult = GateOk | GateFail;

async function resolvePortalUser(
  userId: string | undefined,
  portal: PublicPortal,
): Promise<GateOk | null> {
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { portal: true, deletedAt: true },
  });
  if (user?.portal === portal && !user.deletedAt) {
    return { ok: true, userId, portal };
  }
  return null;
}

function unauthorized(): GateFail {
  return {
    ok: false,
    response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
  };
}

function ambiguousPortal(): GateFail {
  return {
    ok: false,
    response: NextResponse.json(
      { error: "ambiguous_portal" },
      { status: 409 },
    ),
  };
}

export async function requirePortalUser(): Promise<GateResult> {
  const [clientSession, masseurSession, requestHeaders] = await Promise.all([
    clientAuth(),
    masseurAuth(),
    headers(),
  ]);

  const hintRaw = requestHeaders.get(PORTAL_REQUEST_HEADER);
  const hint = isPublicPortal(hintRaw) ? hintRaw : null;

  const [client, masseur] = await Promise.all([
    resolvePortalUser(clientSession?.user?.id, "client"),
    resolvePortalUser(masseurSession?.user?.id, "masseur"),
  ]);

  if (hint === "client") {
    return client ?? unauthorized();
  }
  if (hint === "masseur") {
    return masseur ?? unauthorized();
  }

  if (client && masseur) {
    return ambiguousPortal();
  }
  if (client) return client;
  if (masseur) return masseur;
  return unauthorized();
}
