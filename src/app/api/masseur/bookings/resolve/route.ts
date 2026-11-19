import { NextResponse } from "next/server";
import { auth } from "@/auth/masseur";
import { SLOT_MS } from "@/lib/booking-constants";
import { alignToHour } from "@/lib/masseur-time";
import { getMasseurTimeZone } from "@/lib/masseur-time.server";
import { notifyMasseurCancelledBooking } from "@/lib/notifications/outbox";
import { prisma } from "@/lib/prisma";
import {
  masseurBookingResolveSchema,
  parseWithSchema,
} from "@/lib/validation";

async function requireMasseur() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  const timeZone = await getMasseurTimeZone(session.user.id);
  if (!timeZone) {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { userId: session.user.id, timeZone };
}

export async function POST(request: Request) {
  try {
    const gate = await requireMasseur();
    if ("error" in gate) return gate.error;

    const body = await request.json();
    const parsed = parseWithSchema(masseurBookingResolveSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const requested = new Date(parsed.data.slotStart);
    if (Number.isNaN(requested.getTime())) {
      return NextResponse.json({ error: "invalid_slot" }, { status: 400 });
    }
    const slotStart = alignToHour(requested, gate.timeZone);

    if (slotStart.getTime() <= Date.now()) {
      return NextResponse.json({ error: "slot_unavailable" }, { status: 409 });
    }

    const slotEnd = new Date(slotStart.getTime() + SLOT_MS);
    const keepAvailable = parsed.data.availability === "available";

    const cancelledBookingId = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({
        where: {
          masseurId: gate.userId,
          slotStart,
          status: { not: "cancelled" },
        },
        select: { id: true, clientUserId: true },
      });

      let notifyId: string | null = null;

      if (booking) {
        // Atomic claim (#82): do not overwrite a concurrent client cancel.
        const claimed = await tx.booking.updateMany({
          where: {
            id: booking.id,
            masseurId: gate.userId,
            status: "confirmed",
          },
          data: {
            status: "cancelled",
            cancelledBy: "masseur",
            cancelledAt: new Date(),
          },
        });
        if (claimed.count === 1 && booking.clientUserId) {
          notifyId = booking.id;
        }
      } else {
        // Client may have cancelled first in a race — still apply availability.
        const alreadyCancelled = await tx.booking.findFirst({
          where: {
            masseurId: gate.userId,
            slotStart,
            status: "cancelled",
          },
          select: { id: true },
        });
        if (!alreadyCancelled) {
          throw new Error("not_found");
        }
      }

      if (keepAvailable) {
        await tx.availabilitySlot.upsert({
          where: {
            masseurId_start: {
              masseurId: gate.userId,
              start: slotStart,
            },
          },
          create: {
            masseurId: gate.userId,
            start: slotStart,
            end: slotEnd,
          },
          update: { end: slotEnd },
        });
      } else {
        await tx.availabilitySlot.deleteMany({
          where: {
            masseurId: gate.userId,
            start: slotStart,
          },
        });
      }

      return notifyId;
    });

    if (cancelledBookingId) {
      try {
        await notifyMasseurCancelledBooking(cancelledBookingId);
      } catch (notifyError) {
        console.error(
          "[masseur/bookings/resolve] notifyMasseurCancelledBooking",
          notifyError,
        );
      }
    }

    return NextResponse.json({
      ok: true,
      availability: parsed.data.availability,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "not_found") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    console.error("[masseur/bookings/resolve]", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
