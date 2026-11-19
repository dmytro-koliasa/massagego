import { NextResponse } from "next/server";
import { syntheticBookedSlotEventId } from "@/lib/availability-event-id";
import { SLOT_MS } from "@/lib/booking-constants";
import {
  resolveBookingLeadHours,
  resolveBookingSettings,
} from "@/lib/booking-settings";
import { requireClientSession } from "@/lib/client-session.server";
import {
  CALENDAR_AVAILABILITY_MAX_SPAN_MS,
  parseRequiredDateRange,
} from "@/lib/date-range";
import { logRouteError } from "@/lib/http/route-error";
import { isMasseurListed } from "@/lib/masseur-catalog";
import {
  clientBookingWindowExclusiveEnd,
  isClientBookableSlot,
  resolveTimeZone,
} from "@/lib/masseur-time";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

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
    const range = parseRequiredDateRange(
      searchParams.get("from"),
      searchParams.get("to"),
      CALENDAR_AVAILABILITY_MAX_SPAN_MS,
    );
    if (!range.ok) {
      return NextResponse.json({ error: range.error }, { status: 400 });
    }
    const { from, to } = range;

    const masseur = await prisma.user.findFirst({
      where: {
        id,
        portal: "masseur",
        deletedAt: null,
        blockedAt: null,
      },
      select: {
        id: true,
        nameEn: true,
        nameUk: true,
        cityPlaceId: true,
        address: true,
        timezone: true,
        bookingLeadHours: true,
        cancelCutoffHours: true,
        phone: true,
        emailVerified: true,
        _count: { select: { availabilitySlots: true } },
      },
    });

    if (!masseur) {
      return NextResponse.json({ error: "masseur_not_found" }, { status: 404 });
    }

    if (!isMasseurListed(masseur)) {
      return NextResponse.json(
        { error: "MASSEUR_NOT_READY" },
        { status: 409 },
      );
    }

    const timezone = resolveTimeZone(masseur.timezone);
    const settings = resolveBookingSettings(masseur);
    const leadHours = resolveBookingLeadHours(masseur.bookingLeadHours);
    const now = new Date();
    const windowEnd = clientBookingWindowExclusiveEnd(now, timezone);

    // Entire requested range is beyond the 120-day window.
    if (from.getTime() >= windowEnd.getTime()) {
      return NextResponse.json(
        { error: "BOOKING_WINDOW_EXCEEDED" },
        { status: 400 },
      );
    }

    const rangeStart = from > now ? from : now;
    const rangeEnd = to.getTime() < windowEnd.getTime() ? to : windowEnd;

    if (rangeStart.getTime() >= rangeEnd.getTime()) {
      return NextResponse.json({
        timezone,
        bookingLeadHours: leadHours,
        cancelCutoffHours: settings.cancelCutoffHours,
        masseurPhone: masseur.phone?.trim() || null,
        bookingWindowEnd: windowEnd.toISOString(),
        slots: [],
      });
    }

    const [slots, bookings] = await Promise.all([
      prisma.availabilitySlot.findMany({
        where: {
          masseurId: id,
          start: { gte: rangeStart, lt: rangeEnd },
        },
        orderBy: { start: "asc" },
        select: { id: true, start: true, end: true },
      }),
      prisma.booking.findMany({
        where: {
          masseurId: id,
          slotStart: { gte: rangeStart, lt: rangeEnd },
          status: { not: "cancelled" },
        },
        select: {
          id: true,
          slotStart: true,
          clientUserId: true,
          massageType: true,
        },
      }),
    ]);

    const bookedByStart = new Map(
      bookings
        .filter((booking) => booking.slotStart)
        .map((booking) => {
          const mine = booking.clientUserId === client.userId;
          return [
            booking.slotStart!.toISOString(),
            {
              bookingId: booking.id,
              mine,
              // Only expose details for the client's own booking.
              massageType: mine ? booking.massageType : null,
            },
          ] as const;
        }),
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
            massageType: booked?.mine ? booked.massageType : null,
          },
        ] as const;
      }),
    );

    // Keep booked hours visible even if availability row was removed.
    for (const [startIso, booked] of bookedByStart) {
      if (byStart.has(startIso)) continue;
      const start = new Date(startIso);
      byStart.set(startIso, {
        id: syntheticBookedSlotEventId(startIso),
        start: startIso,
        end: new Date(start.getTime() + SLOT_MS).toISOString(),
        status: "booked",
        mine: booked.mine,
        bookingId: booked.mine ? booked.bookingId : null,
        massageType: booked.mine ? booked.massageType : null,
      });
    }

    // Hide free slots inside the lead time; keep the client's own bookings.
    const visible = [...byStart.values()].filter((slot) => {
      if (slot.status === "booked" && slot.mine) return true;
      return isClientBookableSlot(
        new Date(slot.start),
        timezone,
        leadHours,
        now,
      );
    });

    return NextResponse.json({
      timezone,
      bookingLeadHours: leadHours,
      cancelCutoffHours: settings.cancelCutoffHours,
      masseurPhone: masseur.phone?.trim() || null,
      bookingWindowEnd: windowEnd.toISOString(),
      slots: visible.sort((a, b) => a.start.localeCompare(b.start)),
    });
  } catch (error) {
    logRouteError("masseurs/[id]/availability", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
