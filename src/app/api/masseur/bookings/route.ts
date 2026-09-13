import { NextResponse } from "next/server";
import { auth } from "@/auth/masseur";
import {
  isMassageTypeValue,
  parseMassageTypes,
} from "@/lib/massage-types";
import { userHasPortal } from "@/lib/portals.server";
import { prisma } from "@/lib/prisma";
import {
  masseurBookingCreateSchema,
  parseWithSchema,
} from "@/lib/validation";

const SLOT_MS = 60 * 60 * 1000;

function alignToHour(date: Date) {
  const aligned = new Date(date);
  aligned.setMinutes(0, 0, 0);
  return aligned;
}

function isSlotExpired(start: Date) {
  // Block once the slot hour has started (8:01 for an 8:00–9:00 slot).
  return start.getTime() <= Date.now();
}

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

export async function POST(request: Request) {
  try {
    const gate = await requireMasseur();
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
    const slotStart = alignToHour(slotStartRaw);

    if (isSlotExpired(slotStart)) {
      return NextResponse.json({ error: "slot_unavailable" }, { status: 409 });
    }

    const masseur = await prisma.user.findFirst({
      where: { id: gate.userId, portal: "masseur" },
      select: { id: true, massageTypes: true },
    });
    if (!masseur) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
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
          clientEmail: null,
          preferredDate: null,
          preferredTime: null,
          slotStart,
          massageType,
          note: note || null,
          status: "pending",
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
    console.error("[masseur/bookings]", error);
    if (error instanceof Error && error.message === "slot_taken") {
      return NextResponse.json({ error: "slot_taken" }, { status: 409 });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
