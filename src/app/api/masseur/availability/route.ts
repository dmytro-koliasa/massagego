import { NextResponse } from "next/server";
import { auth } from "@/auth/masseur";
import { userHasPortal } from "@/lib/portals.server";
import { prisma } from "@/lib/prisma";

const SLOT_MS = 60 * 60 * 1000;
const DAY_START_HOUR = 5;
const DAY_END_HOUR = 23;

function alignToHour(date: Date) {
  const aligned = new Date(date);
  aligned.setMinutes(0, 0, 0);
  return aligned;
}

function isWithinBusinessHours(start: Date) {
  const hour = start.getHours();
  return hour >= DAY_START_HOUR && hour < DAY_END_HOUR;
}

function addWeeks(date: Date, weeks: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + weeks * 7);
  return next;
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

export async function GET(request: Request) {
  const gate = await requireMasseur();
  if ("error" in gate) return gate.error;

  const { searchParams } = new URL(request.url);
  const fromRaw = searchParams.get("from");
  const toRaw = searchParams.get("to");
  const from = fromRaw ? new Date(fromRaw) : null;
  const to = toRaw ? new Date(toRaw) : null;

  if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return NextResponse.json({ error: "invalid_range" }, { status: 400 });
  }

  const [slots, bookings] = await Promise.all([
    prisma.availabilitySlot.findMany({
      where: {
        masseurId: gate.userId,
        start: { gte: from, lt: to },
      },
      orderBy: { start: "asc" },
      select: { id: true, start: true, end: true },
    }),
    prisma.booking.findMany({
      where: {
        masseurId: gate.userId,
        slotStart: { gte: from, lt: to },
        status: { not: "cancelled" },
      },
      select: {
        id: true,
        slotStart: true,
        clientName: true,
        clientPhone: true,
        massageType: true,
      },
    }),
  ]);

  const bookedByStart = new Map(
    bookings
      .filter((booking) => booking.slotStart)
      .map((booking) => [
        booking.slotStart!.toISOString(),
        {
          id: booking.id,
          clientName: booking.clientName,
          clientPhone: booking.clientPhone,
          massageType: booking.massageType,
        },
      ]),
  );

  const byStart = new Map(
    slots.map((slot) => {
      const start = slot.start.toISOString();
      const booked = bookedByStart.get(start);
      return [
        start,
        {
          id: slot.id,
          start,
          end: slot.end.toISOString(),
          status: booked ? ("booked" as const) : ("available" as const),
          clientName: booked?.clientName ?? null,
          clientPhone: booked?.clientPhone ?? null,
          massageType: booked?.massageType ?? null,
          bookingId: booked?.id ?? null,
        },
      ];
    }),
  );

  // Keep booked hours visible even if the availability row was removed.
  for (const [startIso, booked] of bookedByStart) {
    if (byStart.has(startIso)) continue;
    const start = new Date(startIso);
    byStart.set(startIso, {
      id: `booking-${booked.id}`,
      start: startIso,
      end: new Date(start.getTime() + SLOT_MS).toISOString(),
      status: "booked",
      clientName: booked.clientName,
      clientPhone: booked.clientPhone,
      massageType: booked.massageType,
      bookingId: booked.id,
    });
  }

  return NextResponse.json({
    slots: [...byStart.values()].sort((a, b) => a.start.localeCompare(b.start)),
  });
}

async function applySlotChange(userId: string, startRaw: string, active: boolean) {
  const startDate = new Date(startRaw);
  if (Number.isNaN(startDate.getTime())) {
    return { error: "invalid_start" as const };
  }

  const start = alignToHour(startDate);
  if (!isWithinBusinessHours(start)) {
    return { error: "out_of_hours" as const };
  }

  const end = new Date(start.getTime() + SLOT_MS);
  const existing = await prisma.availabilitySlot.findUnique({
    where: {
      masseurId_start: {
        masseurId: userId,
        start,
      },
    },
    select: { id: true },
  });

  if (active) {
    if (existing) {
      return {
        action: "added" as const,
        slot: {
          id: existing.id,
          start: start.toISOString(),
          end: end.toISOString(),
        },
      };
    }
    const slot = await prisma.availabilitySlot.create({
      data: { masseurId: userId, start, end },
      select: { id: true, start: true, end: true },
    });
    return {
      action: "added" as const,
      slot: {
        id: slot.id,
        start: slot.start.toISOString(),
        end: slot.end.toISOString(),
      },
    };
  }

  if (existing) {
    const booking = await prisma.booking.findFirst({
      where: {
        masseurId: userId,
        slotStart: start,
        status: { not: "cancelled" },
      },
      select: { id: true },
    });
    if (booking) {
      return { error: "slot_booked" as const };
    }

    await prisma.availabilitySlot.delete({ where: { id: existing.id } });
    return {
      action: "removed" as const,
      slot: {
        id: existing.id,
        start: start.toISOString(),
        end: end.toISOString(),
      },
    };
  }

  return {
    action: "removed" as const,
    slot: {
      id: "",
      start: start.toISOString(),
      end: end.toISOString(),
    },
  };
}

export async function POST(request: Request) {
  const gate = await requireMasseur();
  if ("error" in gate) return gate.error;

  try {
    const body = await request.json();

    if (Array.isArray(body.changes)) {
      const results = [];
      for (const change of body.changes) {
        if (typeof change?.start !== "string" || typeof change?.active !== "boolean") {
          continue;
        }
        const result = await applySlotChange(gate.userId, change.start, change.active);
        if ("error" in result) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        results.push(result);
      }
      return NextResponse.json({ ok: true, results });
    }

    const startRaw = typeof body.start === "string" ? body.start : "";
    if (!startRaw) {
      return NextResponse.json({ error: "invalid_start" }, { status: 400 });
    }

    const existingCheck = await prisma.availabilitySlot.findUnique({
      where: {
        masseurId_start: {
          masseurId: gate.userId,
          start: alignToHour(new Date(startRaw)),
        },
      },
      select: { id: true },
    });

    const result = await applySlotChange(
      gate.userId,
      startRaw,
      !existingCheck,
    );
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const gate = await requireMasseur();
  if ("error" in gate) return gate.error;

  try {
    const body = await request.json();
    const fromRaw = typeof body.from === "string" ? body.from : "";
    const toRaw = typeof body.to === "string" ? body.to : "";
    const weeksAhead =
      typeof body.weeksAhead === "number" && body.weeksAhead > 0
        ? Math.min(Math.floor(body.weeksAhead), 52)
        : 12;

    const from = new Date(fromRaw);
    const to = new Date(toRaw);

    if (
      !fromRaw ||
      !toRaw ||
      Number.isNaN(from.getTime()) ||
      Number.isNaN(to.getTime()) ||
      to <= from
    ) {
      return NextResponse.json({ error: "invalid_range" }, { status: 400 });
    }

    const now = Date.now();
    if (now < from.getTime() || now >= to.getTime()) {
      return NextResponse.json({ error: "not_current_week" }, { status: 400 });
    }

    let template: { start: Date; end: Date }[] = [];

    if (Array.isArray(body.template)) {
      for (const item of body.template) {
        const startRaw =
          typeof item === "string"
            ? item
            : typeof item?.start === "string"
              ? item.start
              : "";
        if (!startRaw) continue;
        const start = alignToHour(new Date(startRaw));
        if (Number.isNaN(start.getTime())) continue;
        template.push({
          start,
          end: new Date(start.getTime() + SLOT_MS),
        });
      }
    } else {
      template = await prisma.availabilitySlot.findMany({
        where: {
          masseurId: gate.userId,
          start: { gte: from, lt: to },
        },
        select: { start: true, end: true },
        orderBy: { start: "asc" },
      });
    }

    const futureEnd = addWeeks(to, weeksAhead);

    const futureBookings = await prisma.booking.findMany({
      where: {
        masseurId: gate.userId,
        slotStart: { gte: to, lt: futureEnd },
        status: { not: "cancelled" },
      },
      select: { slotStart: true },
    });
    const protectedStarts = futureBookings
      .map((booking) => booking.slotStart)
      .filter((value): value is Date => Boolean(value));

    await prisma.availabilitySlot.deleteMany({
      where: {
        masseurId: gate.userId,
        start: { gte: to, lt: futureEnd },
        ...(protectedStarts.length > 0
          ? { NOT: { start: { in: protectedStarts } } }
          : {}),
      },
    });

    if (template.length > 0) {
      const protectedIso = new Set(
        protectedStarts.map((start) => start.toISOString()),
      );
      const data = [];
      for (let week = 1; week <= weeksAhead; week += 1) {
        for (const slot of template) {
          const start = addWeeks(slot.start, week);
          if (Number.isNaN(start.getTime())) continue;
          if (protectedIso.has(start.toISOString())) continue;
          data.push({
            masseurId: gate.userId,
            start,
            end: addWeeks(slot.end, week),
          });
        }
      }

      if (data.length > 0) {
        await prisma.availabilitySlot.createMany({ data });
      }
    }

    return NextResponse.json({
      ok: true,
      weeksAhead,
      copiedSlots: template.length,
    });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
