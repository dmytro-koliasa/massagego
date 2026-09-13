import { NextResponse } from "next/server";
import { requireClientSession } from "@/lib/client-session.server";
import { prisma } from "@/lib/prisma";
import { bookingCancelSchema, parseWithSchema } from "@/lib/validation";

function alignToHour(date: Date) {
  const aligned = new Date(date);
  aligned.setMinutes(0, 0, 0);
  return aligned;
}

export async function POST(request: Request) {
  try {
    const client = await requireClientSession();
    if (!client.ok) {
      return NextResponse.json(
        { error: client.error },
        { status: client.status },
      );
    }

    const body = await request.json();
    const parsed = parseWithSchema(bookingCancelSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    let booking: { id: string } | null = null;

    if ("bookingId" in parsed.data) {
      booking = await prisma.booking.findFirst({
        where: {
          id: parsed.data.bookingId,
          clientUserId: client.userId,
          status: { not: "cancelled" },
        },
        select: { id: true },
      });
    } else {
      const slotStart = alignToHour(new Date(parsed.data.slotStart));
      if (Number.isNaN(slotStart.getTime())) {
        return NextResponse.json({ error: "invalid_slot" }, { status: 400 });
      }

      booking = await prisma.booking.findFirst({
        where: {
          masseurId: parsed.data.masseurId,
          slotStart,
          clientUserId: client.userId,
          status: { not: "cancelled" },
        },
        select: { id: true },
      });
    }

    // Own-booking only: missing or someone else's booking looks the same.
    if (!booking) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "cancelled" },
    });

    return NextResponse.json({ ok: true, bookingId: booking.id });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
