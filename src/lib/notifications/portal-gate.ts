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
    select: { portal: true, deletedAt: true, blockedAt: true },
  });
  if (
    user?.portal === portal &&
    !user.deletedAt &&
    !user.blockedAt
  ) {
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

function forbidden(): GateFail {
  return {
    ok: false,
    response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
  };
}

/** Session cookie present but DB membership rejected → 403; else 401. */
function rejectSession(sessionUserId: string | undefined): GateFail {
  return sessionUserId ? forbidden() : unauthorized();
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

  const clientId = clientSession?.user?.id;
  const masseurId = masseurSession?.user?.id;

  const [client, masseur] = await Promise.all([
    resolvePortalUser(clientId, "client"),
    resolvePortalUser(masseurId, "masseur"),
  ]);

  if (hint === "client") {
    return client ?? rejectSession(clientId);
  }
  if (hint === "masseur") {
    return masseur ?? rejectSession(masseurId);
  }

  if (client && masseur) {
    return ambiguousPortal();
  }
  if (client) return client;
  if (masseur) return masseur;
  if (clientId || masseurId) {
    return forbidden();
  }
  return unauthorized();
}
