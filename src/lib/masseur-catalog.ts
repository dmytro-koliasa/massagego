import type { Prisma } from "@prisma/client";
import { DateTime } from "luxon";
import { resolveBookingLeadHours } from "@/lib/booking-settings";
import {
  clientBookingWindowExclusiveEnd,
  isClientBookableSlot,
  resolveTimeZone,
} from "@/lib/masseur-time";
import { prisma } from "@/lib/prisma";
import { formatTimeZoneOffsetLabel } from "@/lib/timezone";

export type ListedMasseurProfileFields = {
  nameEn?: string | null;
  nameUk?: string | null;
  cityPlaceId?: string | null;
  address?: string | null;
  phone?: string | null;
};

/** Profile fields required for a masseur to appear in the client catalog (BR-010). */
export function isCompleteMasseurProfile(
  user: ListedMasseurProfileFields,
): boolean {
  const hasName = Boolean(user.nameEn?.trim() || user.nameUk?.trim());
  return (
    hasName &&
    Boolean(user.cityPlaceId?.trim()) &&
    Boolean(user.address?.trim()) &&
    Boolean(user.phone?.trim())
  );
}

/**
 * Listed = complete profile + at least one AvailabilitySlot ever (BR-010).
 * Pass `hasAvailability` or `_count.availabilitySlots`.
 */
export function isMasseurListed(
  user: ListedMasseurProfileFields & {
    hasAvailability?: boolean;
    _count?: { availabilitySlots?: number };
  },
): boolean {
  const hasAvailability =
    user.hasAvailability === true ||
    (user._count?.availabilitySlots ?? 0) > 0;
  return isCompleteMasseurProfile(user) && hasAvailability;
}

/** Prisma fragment: complete profile + ever had an availability row. */
export const listedMasseurWhere: Prisma.UserWhereInput = {
  AND: [
    {
      OR: [
        { AND: [{ nameEn: { not: null } }, { nameEn: { not: "" } }] },
        { AND: [{ nameUk: { not: null } }, { nameUk: { not: "" } }] },
      ],
    },
    { AND: [{ cityPlaceId: { not: null } }, { cityPlaceId: { not: "" } }] },
    { AND: [{ address: { not: null } }, { address: { not: "" } }] },
    { AND: [{ phone: { not: null } }, { phone: { not: "" } }] },
    { availabilitySlots: { some: {} } },
  ],
};

export type CatalogLocale = "en" | "uk";

/** Red plaque when no bookable free slot exists in the window. */
export function formatNoFreeTimeLabel(locale: CatalogLocale): string {
  return locale === "uk" ? "Немає вільного часу" : "No free time";
}

/**
 * Green plaque: "Nearest: today, HH:mm (Kyiv, UTC+02:00)" / UK equivalent.
 * `weekday+date` for days beyond tomorrow.
 */
export function formatNearestLabel(
  instant: Date,
  timezone: string,
  locale: CatalogLocale,
  now: Date = new Date(),
): string {
  const zone = resolveTimeZone(timezone);
  const slot = DateTime.fromJSDate(instant, { zone });
  const today = DateTime.fromJSDate(now, { zone }).startOf("day");
  const dayDiff = Math.round(slot.startOf("day").diff(today, "days").days);
  const time = slot.toFormat("HH:mm");
  const tzLabel = formatTimeZoneOffsetLabel(zone, instant);

  let when: string;
  if (dayDiff === 0) {
    when = locale === "uk" ? `сьогодні, ${time}` : `today, ${time}`;
  } else if (dayDiff === 1) {
    when = locale === "uk" ? `завтра, ${time}` : `tomorrow, ${time}`;
  } else {
    const weekdayDate = slot
      .setLocale(locale === "uk" ? "uk" : "en-GB")
      .toFormat("ccc, d LLL");
    when = `${weekdayDate}, ${time}`;
  }

  const prefix = locale === "uk" ? "Найближче" : "Nearest";
  return `${prefix}: ${when} (${tzLabel})`;
}

export function availabilityLabelForNearest(
  nearest: Date | null,
  timezone: string,
  locale: CatalogLocale,
  now: Date = new Date(),
): string {
  if (!nearest) return formatNoFreeTimeLabel(locale);
  return formatNearestLabel(nearest, timezone, locale, now);
}

/** Free-time first, then `createdAt` DESC within each group. */
export function compareMasseurCatalogOrder(
  a: { hasFreeTime: boolean; createdAt: Date | string },
  b: { hasFreeTime: boolean; createdAt: Date | string },
): number {
  if (a.hasFreeTime !== b.hasFreeTime) {
    return a.hasFreeTime ? -1 : 1;
  }
  const aTime = new Date(a.createdAt).getTime();
  const bTime = new Date(b.createdAt).getTime();
  return bTime - aTime;
}

type MasseurNearestContext = {
  id: string;
  timezone: string | null;
  bookingLeadHours: number | null;
};

/**
 * Nearest client-bookable free slot per masseur within the 120-day window
 * and outside that masseur's lead time. Returns `null` when none.
 */
export async function findNearestFreeSlots(
  masseurs: MasseurNearestContext[],
  now: Date = new Date(),
): Promise<Map<string, Date | null>> {
  const result = new Map<string, Date | null>();
  if (masseurs.length === 0) return result;

  for (const masseur of masseurs) {
    result.set(masseur.id, null);
  }

  const byId = new Map(masseurs.map((m) => [m.id, m]));
  const ids = masseurs.map((m) => m.id);

  // Upper bound that covers every masseur zone's exclusive booking window end.
  let rangeEnd = now;
  for (const masseur of masseurs) {
    const zone = resolveTimeZone(masseur.timezone);
    const end = clientBookingWindowExclusiveEnd(now, zone);
    if (end.getTime() > rangeEnd.getTime()) rangeEnd = end;
  }

  const [slots, bookings] = await Promise.all([
    prisma.availabilitySlot.findMany({
      where: {
        masseurId: { in: ids },
        start: { gt: now, lt: rangeEnd },
      },
      orderBy: { start: "asc" },
      select: { masseurId: true, start: true },
    }),
    prisma.booking.findMany({
      where: {
        masseurId: { in: ids },
        slotStart: { gt: now, lt: rangeEnd },
        status: { not: "cancelled" },
      },
      select: { masseurId: true, slotStart: true },
    }),
  ]);

  const booked = new Set<string>();
  for (const booking of bookings) {
    if (!booking.slotStart) continue;
    booked.add(`${booking.masseurId}:${booking.slotStart.toISOString()}`);
  }

  const found = new Set<string>();
  for (const slot of slots) {
    if (found.has(slot.masseurId)) continue;
    if (booked.has(`${slot.masseurId}:${slot.start.toISOString()}`)) continue;

    const masseur = byId.get(slot.masseurId);
    if (!masseur) continue;

    const zone = resolveTimeZone(masseur.timezone);
    const leadHours = resolveBookingLeadHours(masseur.bookingLeadHours);
    if (!isClientBookableSlot(slot.start, zone, leadHours, now)) continue;

    result.set(slot.masseurId, slot.start);
    found.add(slot.masseurId);
    if (found.size === ids.length) break;
  }

  return result;
}
