import { NextResponse } from "next/server";
import { auth } from "@/auth/masseur";
import {
  lastCancellationSince,
  mapRecentCancellations,
  RECENT_CANCELLATIONS_LIMIT,
} from "@/lib/last-cancellation";
import { prisma } from "@/lib/prisma";
import { userHasPortal } from "@/lib/portals.server";

async function requireMasseur() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  const allowed = await userHasPortal(session.user.id, "masseur");
  if (!allowed) {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { userId: session.user.id };
}

export async function GET() {
  const gate = await requireMasseur();
  if ("error" in gate) return gate.error;

  const since = lastCancellationSince();
  const rows = await prisma.booking.findMany({
    where: {
      masseurId: gate.userId,
      status: "cancelled",
      cancelledBy: "client",
      cancelledAt: { gte: since },
      cancelReason: { not: null },
      slotStart: { not: null },
    },
    orderBy: { cancelledAt: "desc" },
    take: RECENT_CANCELLATIONS_LIMIT,
    select: {
      id: true,
      slotStart: true,
      cancelledAt: true,
      clientName: true,
      cancelReason: true,
      cancelReasonText: true,
    },
  });

  return NextResponse.json({
    cancellations: mapRecentCancellations(rows),
  });
}
