import { NextResponse } from "next/server";
import { resolveBookingSettings } from "@/lib/booking-settings";
import {
  isWithinClientCancelWindow,
  neighbouringSlotStarts,
} from "@/lib/client-booking-rules";
import { requireClientSession } from "@/lib/client-session.server";
import { alignToHour } from "@/lib/masseur-time";
import { getMasseurTimeZone } from "@/lib/masseur-time.server";
import { prisma } from "@/lib/prisma";
import { bookingCancelSchema, parseWithSchema } from "@/lib/validation";

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
      const error =
        parsed.error === "CANCEL_REASON_REQUIRED"
          ? "CANCEL_REASON_REQUIRED"
          : parsed.error;
      return NextResponse.json({ error }, { status: 400 });
    }

    const { cancelReason, cancelReasonText } = parsed.data;
    const reasonText =
      cancelReason === "other" ? cancelReasonText || null : null;

    let booking: {
      id: string;
      status: "confirmed" | "cancelled";
      slotStart: Date | null;
      massageType: string | null;
      masseurId: string;
      masseur: {
        phone: string | null;
        timezone: string;
        cancelCutoffHours: number;
        bookingLeadHours: number;
      };
    } | null = null;

    if ("bookingId" in parsed.data) {
      booking = await prisma.booking.findFirst({
        where: {
          id: parsed.data.bookingId,
          clientUserId: client.userId,
        },
        select: {
          id: true,
          status: true,
          slotStart: true,
          massageType: true,
          masseurId: true,
          masseur: {
            select: {
              phone: true,
              timezone: true,
              cancelCutoffHours: true,
              bookingLeadHours: true,
            },
          },
        },
      });
    } else {
      const requested = new Date(parsed.data.slotStart);
      if (Number.isNaN(requested.getTime())) {
        return NextResponse.json({ error: "invalid_slot" }, { status: 400 });
      }

      const timeZone = await getMasseurTimeZone(parsed.data.masseurId);
      if (timeZone) {
        booking = await prisma.booking.findFirst({
          where: {
            masseurId: parsed.data.masseurId,
            slotStart: alignToHour(requested, timeZone),
            clientUserId: client.userId,
          },
          select: {
            id: true,
            status: true,
            slotStart: true,
            massageType: true,
            masseurId: true,
            masseur: {
              select: {
                phone: true,
                timezone: true,
                cancelCutoffHours: true,
                bookingLeadHours: true,
              },
            },
          },
        });
      }
    }

    // Own-booking only: missing or someone else's booking looks the same (404).
    if (!booking) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    // Idempotent: already cancelled by this client.
    if (booking.status === "cancelled") {
      return NextResponse.json({ ok: true, bookingId: booking.id });
    }

    if (!booking.slotStart) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const { cancelCutoffHours: cutoffHours } = resolveBookingSettings(
      booking.masseur,
    );
    const now = new Date();
    if (!isWithinClientCancelWindow(booking.slotStart, cutoffHours, now)) {
      const phone = booking.masseur.phone?.trim() || null;
      return NextResponse.json(
        {
          error: "CANCEL_CUTOFF_PASSED",
          masseurPhone: phone,
        },
        { status: 409 },
      );
    }

    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: "cancelled",
        cancelledBy: "client",
        cancelledAt: now,
        cancelReason,
        cancelReasonText: reasonText,
      },
    });

    let neighborHint:
      | { type: "thai_cutoff"; masseurPhone: string | null }
      | undefined;

    if (booking.massageType === "thai") {
      const neighbourStarts = neighbouringSlotStarts(booking.slotStart);
      const neighbour = await prisma.booking.findFirst({
        where: {
          clientUserId: client.userId,
          masseurId: booking.masseurId,
          massageType: "thai",
          status: { not: "cancelled" },
          slotStart: { in: neighbourStarts },
        },
        select: { slotStart: true },
      });
      if (
        neighbour?.slotStart &&
        !isWithinClientCancelWindow(neighbour.slotStart, cutoffHours, now)
      ) {
        neighborHint = {
          type: "thai_cutoff",
          masseurPhone: booking.masseur.phone?.trim() || null,
        };
      }
    }

    return NextResponse.json({
      ok: true,
      bookingId: booking.id,
      ...(neighborHint ? { neighborHint } : {}),
    });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
