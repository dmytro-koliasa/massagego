import { NextResponse } from "next/server";
import {
  lastCancellationSince,
  mapRecentCancellations,
  RECENT_CANCELLATIONS_LIMIT,
} from "@/lib/last-cancellation";
import { requireMasseurSession } from "@/lib/masseur-session.server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const gate = await requireMasseurSession();
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
