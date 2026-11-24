import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/auth/masseur";
import { resolveTimeZone } from "@/lib/masseur-time";
import { prisma } from "@/lib/prisma";

type RequireMasseurFail = { ok: false; response: NextResponse };
type RequireMasseurOk = { ok: true; userId: string };
type RequireMasseurOkWithTimeZone = {
  ok: true;
  userId: string;
  timeZone: string;
};

/**
 * Shared masseur API gate (#90 / #187 unified shape).
 *
 * Always require an active (non-deleted, non-blocked) masseur.
 * Pass `{ withTimeZone: true }` when the handler needs the masseur IANA zone.
 */
export async function requireMasseurSession(
  options: { withTimeZone: true },
): Promise<RequireMasseurOkWithTimeZone | RequireMasseurFail>;
export async function requireMasseurSession(
  options?: { withTimeZone?: false },
): Promise<RequireMasseurOk | RequireMasseurFail>;
export async function requireMasseurSession(options?: {
  withTimeZone?: boolean;
}): Promise<
  RequireMasseurOk | RequireMasseurOkWithTimeZone | RequireMasseurFail
> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }

  const user = await prisma.user.findFirst({
    where: {
      id: session.user.id,
      portal: "masseur",
      deletedAt: null,
      blockedAt: null,
    },
    select: { id: true, timezone: true },
  });
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  }

  if (options?.withTimeZone) {
    return {
      ok: true,
      userId: user.id,
      timeZone: resolveTimeZone(user.timezone),
    };
  }

  return { ok: true, userId: user.id };
}
