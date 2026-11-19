import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/auth/masseur";
import { resolveTimeZone } from "@/lib/masseur-time";
import { prisma } from "@/lib/prisma";

type RequireMasseurFail = { error: NextResponse };
type RequireMasseurOk = { userId: string };
type RequireMasseurOkWithTimeZone = { userId: string; timeZone: string };

/**
 * Shared masseur API gate (#90).
 *
 * Previously duplicated across routes with two slightly different checks:
 * - `userHasPortal` (portal + not deleted + not blocked)
 * - `getMasseurTimeZone` (portal only — did **not** reject blocked/deleted)
 *
 * Unified behavior: always require an active (non-deleted, non-blocked) masseur.
 * Pass `{ withTimeZone: true }` when the handler needs the masseur IANA zone
 * (availability writes, resolve). Bulk-cancel only needed membership; it does
 * not request a timezone.
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
      error: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
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
      error: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  }

  if (options?.withTimeZone) {
    return {
      userId: user.id,
      timeZone: resolveTimeZone(user.timezone),
    };
  }

  return { userId: user.id };
}
