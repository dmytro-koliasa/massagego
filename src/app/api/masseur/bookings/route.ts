import { NextResponse } from "next/server";
import {
  isMassageTypeValue,
  parseMassageTypes,
} from "@/lib/massage-types";
import {
  isBookingConflictError,
  lockMasseurBookings,
} from "@/lib/booking-conflict";
import { SLOT_MS } from "@/lib/booking-constants";
import { logRouteError } from "@/lib/http/route-error";
import {
  alignToHour,
  isWithinWorkingHours,
  resolveTimeZone,
} from "@/lib/masseur-time";
import { requireMasseurSession } from "@/lib/masseur-session.server";
import { prisma } from "@/lib/prisma";
import {
  masseurBookingCreateSchema,
  parseWithSchema,
} from "@/lib/validation";

function isSlotExpired(start: Date) {
  // Block once the slot hour has started (8:01 for an 8:00–9:00 slot).
  return start.getTime() <= Date.now();
}

export async function POST(request: Request) {
  try {
    const gate = await requireMasseurSession();
    if ("error" in gate) return gate.error;

    const body = await request.json();
    const parsed = parseWithSchema(masseurBookingCreateSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { clientName, clientPhone, note, massageType: massageTypeRaw } =
      parsed.data;
    // Prefer the client-provided instant as-is (already aligned hour ISO from calendar).
    const slotStartRaw = new Date(parsed.data.slotStart);
    if (Number.isNaN(slotStartRaw.getTime())) {
      return NextResponse.json({ error: "invalid_slot" }, { status: 400 });
    }
    const masseur = await prisma.user.findFirst({
      where: {
        id: gate.userId,
        portal: "masseur",
        deletedAt: null,
        blockedAt: null,
      },
      select: { id: true, massageTypes: true, timezone: true },
    });
    if (!masseur) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const timeZone = resolveTimeZone(masseur.timezone);
    const slotStart = alignToHour(slotStartRaw, timeZone);

    if (!isWithinWorkingHours(slotStart, timeZone)) {
      return NextResponse.json({ error: "out_of_hours" }, { status: 400 });
    }

    if (isSlotExpired(slotStart)) {
      return NextResponse.json({ error: "slot_unavailable" }, { status: 409 });
    }

    const offeredTypes = parseMassageTypes(masseur.massageTypes);
    let massageType: string | null = null;
    if (offeredTypes.length > 0) {
      if (
        !isMassageTypeValue(massageTypeRaw ?? "") ||
        !offeredTypes.includes(massageTypeRaw as (typeof offeredTypes)[number])
      ) {
        return NextResponse.json(
          { error: "invalid_massage_type" },
          { status: 400 },
        );
      }
      massageType = massageTypeRaw!;
    }

    const slotEnd = new Date(slotStart.getTime() + SLOT_MS);

    const booking = await prisma.$transaction(async (tx) => {
      await lockMasseurBookings(tx, gate.userId);

      // Refuse walk-ins if this account is deleted or blocked (#83).
      const self = await tx.user.findFirst({
        where: {
          id: gate.userId,
          portal: "masseur",
          deletedAt: null,
          blockedAt: null,
        },
        select: { id: true },
      });
      if (!self) {
        throw new Error("forbidden");
      }

      const existingBooking = await tx.booking.findFirst({
        where: {
          masseurId: gate.userId,
          slotStart,
          status: { not: "cancelled" },
        },
        select: { id: true },
      });
      if (existingBooking) {
        throw new Error("slot_taken");
      }

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
        update: {
          end: slotEnd,
        },
      });

      return tx.booking.create({
        data: {
          masseurId: gate.userId,
          clientUserId: null,
          clientName,
          clientPhone,
          slotStart,
          massageType,
          note: note || null,
          status: "confirmed",
        },
        select: { id: true, slotStart: true },
      });
    });

    return NextResponse.json(
      {
        booking: {
          id: booking.id,
          slotStart: booking.slotStart?.toISOString() ?? null,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "forbidden") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (
      isBookingConflictError(error) ||
      (error instanceof Error && error.message === "slot_taken")
    ) {
      return NextResponse.json({ error: "slot_taken" }, { status: 409 });
    }
    logRouteError("masseur/bookings", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
