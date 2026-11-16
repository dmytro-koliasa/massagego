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
import { requireClientSession } from "@/lib/client-session.server";
import { alignToHour, resolveTimeZone } from "@/lib/masseur-time";
import { prisma } from "@/lib/prisma";
import { bookingCreateSchema, parseWithSchema } from "@/lib/validation";

function parseAlignedSlots(rawStarts: string[], timeZone: string) {
  const unique = new Map<string, Date>();
  for (const raw of rawStarts) {
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return { error: "invalid_slot" as const };
    }
    const start = alignToHour(parsed, timeZone);
    unique.set(start.toISOString(), start);
  }

  const starts = [...unique.values()].sort(
    (a, b) => a.getTime() - b.getTime(),
  );
  if (starts.length === 0) {
    return { error: "missing_fields" as const };
  }

  return { starts };
}

export async function GET(request: Request) {
  try {
    const client = await requireClientSession();
    if (!client.ok) {
      return NextResponse.json(
        { error: client.error },
        { status: client.status },
      );
    }

    const { searchParams } = new URL(request.url);
    const fromRaw = searchParams.get("from");
    const toRaw = searchParams.get("to");

    const from = fromRaw ? new Date(fromRaw) : null;
    const to = toRaw ? new Date(toRaw) : null;

    if (
      (from && Number.isNaN(from.getTime())) ||
      (to && Number.isNaN(to.getTime()))
    ) {
      return NextResponse.json({ error: "invalid_range" }, { status: 400 });
    }

    const bookings = await prisma.booking.findMany({
      where: {
        clientUserId: client.userId,
        status: { not: "cancelled" },
        slotStart: {
          not: null,
          ...(from ? { gte: from } : {}),
          ...(to ? { lt: to } : {}),
        },
      },
      orderBy: { slotStart: "asc" },
      select: {
        id: true,
        slotStart: true,
        massageType: true,
        status: true,
        masseur: {
          select: {
            id: true,
            name: true,
            nameEn: true,
            nameUk: true,
            timezone: true,
          },
        },
      },
    });

    return NextResponse.json({
      bookings: bookings.map((booking) => ({
        id: booking.id,
        start: booking.slotStart!.toISOString(),
        end: new Date(booking.slotStart!.getTime() + SLOT_MS).toISOString(),
        massageType: booking.massageType,
        status: booking.status,
        masseur: {
          id: booking.masseur.id,
          name: booking.masseur.name,
          nameEn: booking.masseur.nameEn,
          nameUk: booking.masseur.nameUk,
          timezone: resolveTimeZone(booking.masseur.timezone),
        },
      })),
    });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
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
    const parsed = parseWithSchema(bookingCreateSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const {
      masseurId,
      clientName,
      clientPhone,
      note,
      massageType: massageTypeRaw,
      slotStarts: rawStarts,
    } = parsed.data;

    const masseur = await prisma.user.findFirst({
      where: {
        id: masseurId,
        portal: "masseur",
      },
      select: { id: true, massageTypes: true, timezone: true },
    });

    if (!masseur) {
      return NextResponse.json({ error: "masseur_not_found" }, { status: 404 });
    }

    const parsedSlots = parseAlignedSlots(
      rawStarts,
      resolveTimeZone(masseur.timezone),
    );
    if ("error" in parsedSlots) {
      return NextResponse.json({ error: parsedSlots.error }, { status: 400 });
    }

    const now = Date.now();
    for (const slotStart of parsedSlots.starts) {
      if (slotStart.getTime() < now - SLOT_MS) {
        return NextResponse.json({ error: "slot_unavailable" }, { status: 409 });
      }
    }

    const offeredTypes = parseMassageTypes(masseur.massageTypes);
    let massageType: string | null = null;

    if (offeredTypes.length > 0) {
      if (
        !isMassageTypeValue(massageTypeRaw) ||
        !offeredTypes.includes(massageTypeRaw)
      ) {
        return NextResponse.json(
          { error: "invalid_massage_type" },
          { status: 400 },
        );
      }
      massageType = massageTypeRaw;
    }

    const bookings = await prisma.$transaction(async (tx) => {
      await lockMasseurBookings(tx, masseurId);
      const created = [];

      for (const slotStart of parsedSlots.starts) {
        const available = await tx.availabilitySlot.findUnique({
          where: {
            masseurId_start: {
              masseurId,
              start: slotStart,
            },
          },
          select: { id: true },
        });

        if (!available) {
          throw new Error("slot_unavailable");
        }

        const existingBooking = await tx.booking.findFirst({
          where: {
            masseurId,
            slotStart,
            status: { not: "cancelled" },
          },
          select: { id: true },
        });

        if (existingBooking) {
          throw new Error("slot_taken");
        }

        const booking = await tx.booking.create({
          data: {
            masseurId,
            clientUserId: client.userId,
            clientName,
            clientPhone,
            slotStart,
            massageType,
            note: note || null,
            status: "confirmed",
          },
          select: { id: true, slotStart: true },
        });

        created.push({
          id: booking.id,
          slotStart: booking.slotStart?.toISOString() ?? null,
        });
      }

      return created;
    });

    return NextResponse.json({ bookings }, { status: 201 });
  } catch (error) {
    // Concurrent requests can both pass the check above; the database
    // exclusion constraint rejects the loser.
    if (isBookingConflictError(error)) {
      return NextResponse.json({ error: "slot_taken" }, { status: 409 });
    }
    if (error instanceof Error) {
      if (error.message === "slot_unavailable") {
        return NextResponse.json({ error: "slot_unavailable" }, { status: 409 });
      }
      if (error.message === "slot_taken") {
        return NextResponse.json({ error: "slot_taken" }, { status: 409 });
      }
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
