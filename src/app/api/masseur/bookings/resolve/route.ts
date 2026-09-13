import { NextResponse } from "next/server";
import { auth } from "@/auth/masseur";
import { userHasPortal } from "@/lib/portals.server";
import { prisma } from "@/lib/prisma";
import {
  masseurBookingResolveSchema,
  parseWithSchema,
} from "@/lib/validation";

const SLOT_MS = 60 * 60 * 1000;

function alignToHour(date: Date) {
  const aligned = new Date(date);
  aligned.setMinutes(0, 0, 0);
  return aligned;
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
    const parsed = parseWithSchema(masseurBookingResolveSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const slotStart = alignToHour(new Date(parsed.data.slotStart));
    if (Number.isNaN(slotStart.getTime())) {
      return NextResponse.json({ error: "invalid_slot" }, { status: 400 });
    }

    if (slotStart.getTime() <= Date.now()) {
      return NextResponse.json({ error: "slot_unavailable" }, { status: 409 });
    }

    const slotEnd = new Date(slotStart.getTime() + SLOT_MS);
    const keepAvailable = parsed.data.availability === "available";

    await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({
        where: {
          masseurId: gate.userId,
          slotStart,
          status: { not: "cancelled" },
        },
        select: { id: true },
      });

      if (!booking) {
        throw new Error("not_found");
      }

      await tx.booking.update({
        where: { id: booking.id },
        data: { status: "cancelled" },
      });

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
    });

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
