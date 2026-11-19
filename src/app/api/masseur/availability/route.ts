import { NextResponse } from "next/server";
import { auth } from "@/auth/masseur";
import {
  SLOT_MS,
  WEEKLY_COPY_DEFAULT_WEEKS,
  WEEKLY_COPY_MAX_WEEKS,
} from "@/lib/booking-constants";
import {
  lastCancellationSince,
  pickLastCancellationsBySlotStart,
} from "@/lib/last-cancellation";
import {
  addLocalWeeks,
  alignToHour,
  isSlotStarted,
  isWithinWorkingHours,
} from "@/lib/masseur-time";
import { logRouteError } from "@/lib/http/route-error";
import { getMasseurTimeZone } from "@/lib/masseur-time.server";
import { prisma } from "@/lib/prisma";

function statusForSlotError(error: string | undefined) {
  if (error === "slot_in_past" || error === "slot_booked") return 409;
  return 400;
}

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

  const retentionSince = lastCancellationSince();

  const [slots, bookings, cancelledClientBookings] = await Promise.all([
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
        clientUserId: true,
        massageType: true,
        client: {
          select: { phoneConfirmedAt: true },
        },
      },
    }),
    prisma.booking.findMany({
      where: {
        masseurId: gate.userId,
        slotStart: { gte: from, lt: to },
        status: "cancelled",
        cancelledBy: "client",
        cancelledAt: { gte: retentionSince },
        cancelReason: { not: null },
      },
      select: {
        slotStart: true,
        cancelReason: true,
        cancelReasonText: true,
        cancelledAt: true,
      },
    }),
  ]);

  const lastByStart = pickLastCancellationsBySlotStart(
    cancelledClientBookings,
  );

  const bookedByStart = new Map(
    bookings
      .filter((booking) => booking.slotStart)
      .map((booking) => [
        booking.slotStart!.toISOString(),
        {
          id: booking.id,
          clientName: booking.clientName,
          clientPhone: booking.clientPhone,
          clientUserId: booking.clientUserId,
          massageType: booking.massageType,
          clientPhoneConfirmed: Boolean(booking.client?.phoneConfirmedAt),
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
          clientUserId: booked?.clientUserId ?? null,
          clientPhoneConfirmed: booked?.clientPhoneConfirmed ?? false,
          massageType: booked?.massageType ?? null,
          bookingId: booked?.id ?? null,
          lastCancellation: lastByStart.get(start) ?? null,
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
      clientUserId: booked.clientUserId,
      clientPhoneConfirmed: booked.clientPhoneConfirmed,
      massageType: booked.massageType,
      bookingId: booked.id,
      lastCancellation: lastByStart.get(startIso) ?? null,
    });
  }

  return NextResponse.json({
    timezone: gate.timeZone,
    slots: [...byStart.values()].sort((a, b) => a.start.localeCompare(b.start)),
  });
}

async function applySlotChange(
  userId: string,
  timeZone: string,
  startRaw: string,
  active: boolean,
) {
  const startDate = new Date(startRaw);
  if (Number.isNaN(startDate.getTime())) {
    return { error: "invalid_start" as const };
  }

  const start = alignToHour(startDate, timeZone);
  if (!isWithinWorkingHours(start, timeZone)) {
    return { error: "out_of_hours" as const };
  }
  if (isSlotStarted(start)) {
    return { error: "slot_in_past" as const };
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
        const result = await applySlotChange(
          gate.userId,
          gate.timeZone,
          change.start,
          change.active,
        );
        if ("error" in result) {
          const error = result.error;
          return NextResponse.json(
            { error },
            { status: statusForSlotError(error) },
          );
        }
        results.push(result);
      }
      return NextResponse.json({ ok: true, results });
    }

    const startRaw = typeof body.start === "string" ? body.start : "";
    if (!startRaw) {
      return NextResponse.json({ error: "invalid_start" }, { status: 400 });
    }

    const requested = new Date(startRaw);
    if (Number.isNaN(requested.getTime())) {
      return NextResponse.json({ error: "invalid_start" }, { status: 400 });
    }

    const existingCheck = await prisma.availabilitySlot.findUnique({
      where: {
        masseurId_start: {
          masseurId: gate.userId,
          start: alignToHour(requested, gate.timeZone),
        },
      },
      select: { id: true },
    });

    const result = await applySlotChange(
      gate.userId,
      gate.timeZone,
      startRaw,
      !existingCheck,
    );
    if ("error" in result) {
      const error = result.error;
      return NextResponse.json(
        { error },
        { status: statusForSlotError(error) },
      );
    }
    return NextResponse.json(result);
  } catch (error) {
    logRouteError("masseur/availability", error);
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
        ? Math.min(Math.floor(body.weeksAhead), WEEKLY_COPY_MAX_WEEKS)
        : WEEKLY_COPY_DEFAULT_WEEKS;

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
        const requested = new Date(startRaw);
        if (Number.isNaN(requested.getTime())) continue;
        const start = alignToHour(requested, gate.timeZone);
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

    if (
      template.some((slot) => !isWithinWorkingHours(slot.start, gate.timeZone))
    ) {
      return NextResponse.json({ error: "out_of_hours" }, { status: 400 });
    }

    const futureEnd = addLocalWeeks(to, weeksAhead, gate.timeZone);

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
          const start = addLocalWeeks(slot.start, week, gate.timeZone);
          if (protectedIso.has(start.toISOString())) continue;
          data.push({
            masseurId: gate.userId,
            start,
            end: new Date(start.getTime() + SLOT_MS),
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
  } catch (error) {
    logRouteError("masseur/availability", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
