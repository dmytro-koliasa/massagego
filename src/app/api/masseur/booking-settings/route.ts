import { NextResponse } from "next/server";
import {
  applyBookingSettingsUpdate,
  resolveBookingSettings,
} from "@/lib/booking-settings";
import type { BookingLeadHours, CancelCutoffHours } from "@/lib/booking-constants";
import { logRouteError } from "@/lib/http/route-error";
import { requireMasseurSession } from "@/lib/masseur-session.server";
import { prisma } from "@/lib/prisma";
import {
  masseurBookingSettingsSchema,
  parseWithSchema,
} from "@/lib/validation";

export async function GET() {
  const gate = await requireMasseurSession();
  if ("error" in gate) return gate.error;

  const user = await prisma.user.findUnique({
    where: { id: gate.userId },
    select: {
      bookingLeadHours: true,
      cancelCutoffHours: true,
      reminderHours: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ settings: resolveBookingSettings(user) });
}

export async function PATCH(request: Request) {
  const gate = await requireMasseurSession();
  if ("error" in gate) return gate.error;

  try {
    const body = await request.json();
    const parsed = parseWithSchema(masseurBookingSettingsSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const current = await prisma.user.findUnique({
      where: { id: gate.userId },
      select: {
        bookingLeadHours: true,
        cancelCutoffHours: true,
        reminderHours: true,
      },
    });
    if (!current) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const resolved = resolveBookingSettings(current);
    const applied = applyBookingSettingsUpdate({
      currentLead: resolved.bookingLeadHours,
      currentCutoff: resolved.cancelCutoffHours,
      nextLead: parsed.data.bookingLeadHours as BookingLeadHours,
      nextCutoff: parsed.data.cancelCutoffHours as CancelCutoffHours,
    });
    if (!applied.ok) {
      return NextResponse.json({ error: applied.error }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: gate.userId },
      data: {
        bookingLeadHours: applied.bookingLeadHours,
        cancelCutoffHours: applied.cancelCutoffHours,
        reminderHours: parsed.data.reminderHours,
      },
      select: {
        bookingLeadHours: true,
        cancelCutoffHours: true,
        reminderHours: true,
      },
    });

    return NextResponse.json({
      settings: resolveBookingSettings(user),
      cutoffRaised: applied.cutoffRaised,
    });
  } catch (error) {
    logRouteError("masseur/booking-settings", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
