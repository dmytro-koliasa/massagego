import { NextResponse } from "next/server";
import { requireClientSession } from "@/lib/client-session.server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const SLOT_MS = 60 * 60 * 1000;

export async function GET(request: Request, context: RouteContext) {
  try {
    const client = await requireClientSession();
    if (!client.ok) {
      return NextResponse.json(
        { error: client.error },
        { status: client.status },
      );
    }

    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const fromRaw = searchParams.get("from");
    const toRaw = searchParams.get("to");
    const from = fromRaw ? new Date(fromRaw) : null;
    const to = toRaw ? new Date(toRaw) : null;

    if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json({ error: "invalid_range" }, { status: 400 });
    }

    const masseur = await prisma.user.findFirst({
      where: {
        id,
        portal: "masseur",
      },
      select: { id: true },
    });

    if (!masseur) {
      return NextResponse.json({ error: "masseur_not_found" }, { status: 404 });
    }

    const now = new Date();
    const rangeStart = from > now ? from : now;

    const [slots, bookings] = await Promise.all([
      prisma.availabilitySlot.findMany({
        where: {
          masseurId: id,
          start: { gte: rangeStart, lt: to },
        },
        orderBy: { start: "asc" },
        select: { id: true, start: true, end: true },
      }),
      prisma.booking.findMany({
        where: {
          masseurId: id,
          slotStart: { gte: rangeStart, lt: to },
          status: { not: "cancelled" },
        },
        select: { id: true, slotStart: true, clientUserId: true },
      }),
    ]);

    const bookedByStart = new Map(
      bookings
        .filter((booking) => booking.slotStart)
        .map((booking) => [
          booking.slotStart!.toISOString(),
          {
            bookingId: booking.id,
            mine: booking.clientUserId === client.userId,
          },
        ]),
    );

    const byStart = new Map(
      slots.map((slot) => {
        const startIso = slot.start.toISOString();
        const booked = bookedByStart.get(startIso);
        return [
          startIso,
          {
            id: slot.id,
            start: startIso,
            end: slot.end.toISOString(),
            status: booked ? ("booked" as const) : ("available" as const),
            mine: booked?.mine ?? false,
            // Expose booking id only for the owner (cancel by id; no leak of others).
            bookingId: booked?.mine ? booked.bookingId : null,
          },
        ] as const;
      }),
    );

    // Keep booked hours visible even if availability row was removed.
    for (const [startIso, booked] of bookedByStart) {
      if (byStart.has(startIso)) continue;
      const start = new Date(startIso);
      byStart.set(startIso, {
        id: `booking-${booked.bookingId}`,
        start: startIso,
        end: new Date(start.getTime() + SLOT_MS).toISOString(),
        status: "booked",
        mine: booked.mine,
        bookingId: booked.mine ? booked.bookingId : null,
      });
    }

    return NextResponse.json({
      slots: [...byStart.values()].sort((a, b) => a.start.localeCompare(b.start)),
    });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
