import { NextResponse } from "next/server";
import { auth } from "@/auth/masseur";
import {
  applyBookingSettingsUpdate,
  resolveBookingSettings,
} from "@/lib/booking-settings";
import type { BookingLeadHours, CancelCutoffHours } from "@/lib/booking-constants";
import { prisma } from "@/lib/prisma";
import { userHasPortal } from "@/lib/portals.server";
import {
  masseurBookingSettingsSchema,
  parseWithSchema,
} from "@/lib/validation";

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

export async function GET() {
  const gate = await requireMasseur();
  if ("error" in gate) return gate.error;

  const user = await prisma.user.findUnique({
    where: { id: gate.userId },
    select: { bookingLeadHours: true, cancelCutoffHours: true },
  });

  if (!user) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ settings: resolveBookingSettings(user) });
}

export async function PATCH(request: Request) {
  const gate = await requireMasseur();
  if ("error" in gate) return gate.error;

  try {
    const body = await request.json();
    const parsed = parseWithSchema(masseurBookingSettingsSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const current = await prisma.user.findUnique({
      where: { id: gate.userId },
      select: { bookingLeadHours: true, cancelCutoffHours: true },
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
      },
      select: { bookingLeadHours: true, cancelCutoffHours: true },
    });

    return NextResponse.json({
      settings: resolveBookingSettings(user),
      cutoffRaised: applied.cutoffRaised,
    });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
