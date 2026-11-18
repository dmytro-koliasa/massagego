import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { DateTime } from "luxon";

const ZONE = "Europe/Kyiv";
const LEAD_HOURS = 1;
const CUTOFF_HOURS = 24;
const SLOT_MS = 60 * 60 * 1000;
const CLIENT_PASSWORD = "E2eClient123!";

export type BookingFixtureSuite = "book" | "cancel" | "cutoff";

export type BookingFixture = {
  clientPhone: string;
  clientPassword: string;
  masseurSlug: string;
  masseurName: string;
  masseurPhone: string;
  slotStartIso: string;
  needsNextWeek: boolean;
};

const SUITE_IDS: Record<
  BookingFixtureSuite,
  {
    clientEmail: string;
    clientPhone: string;
    masseurEmail: string;
    masseurPhone: string;
    slug: string;
  }
> = {
  book: {
    clientEmail: "e2e-client@test.local",
    clientPhone: "+380501000001",
    masseurEmail: "e2e-masseur@test.local",
    masseurPhone: "+380501000002",
    slug: "e2e-booking-masseur",
  },
  cancel: {
    clientEmail: "e2e-client-cancel@test.local",
    clientPhone: "+380501000003",
    masseurEmail: "e2e-masseur-cancel@test.local",
    masseurPhone: "+380501000004",
    slug: "e2e-cancel-masseur",
  },
  cutoff: {
    clientEmail: "e2e-client-cutoff@test.local",
    clientPhone: "+380501000005",
    masseurEmail: "e2e-masseur-cutoff@test.local",
    masseurPhone: "+380501000006",
    slug: "e2e-cutoff-masseur",
  },
};

function suiteMasseurName(suite: BookingFixtureSuite) {
  if (suite === "cancel") return "E2E Cancel Masseur";
  if (suite === "cutoff") return "E2E Cutoff Masseur";
  return "E2E Booking Masseur";
}

function testPrisma() {
  const databaseUrl =
    process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  return new PrismaClient(
    databaseUrl
      ? { datasources: { db: { url: databaseUrl } } }
      : undefined,
  );
}

function normalizeWorkingHour(candidate: DateTime): DateTime {
  let next = candidate;
  if (next.hour < 5) {
    next = next.set({ hour: 10, minute: 0, second: 0, millisecond: 0 });
  }
  if (next.hour >= 23) {
    next = next
      .plus({ days: 1 })
      .set({ hour: 10, minute: 0, second: 0, millisecond: 0 });
  }
  return next;
}

/** Next hour-aligned slot past lead time, preferably still in the current ISO week. */
export function pickBookableSlotStart(now = DateTime.now().setZone(ZONE)): {
  start: Date;
  needsNextWeek: boolean;
} {
  const weekEnd = now.endOf("week");
  let candidate = normalizeWorkingHour(
    now.plus({ hours: LEAD_HOURS + 1 }).startOf("hour"),
  );

  let needsNextWeek = false;
  if (candidate > weekEnd) {
    needsNextWeek = true;
    candidate = now
      .plus({ weeks: 1 })
      .startOf("week")
      .set({ hour: 10, minute: 0, second: 0, millisecond: 0 });
  }

  const earliest = now.plus({ hours: LEAD_HOURS });
  while (candidate <= earliest) {
    candidate = normalizeWorkingHour(candidate.plus({ hours: 1 }));
  }

  return { start: candidate.toUTC().toJSDate(), needsNextWeek };
}

/**
 * Slot still in the visible week, but already inside the cancel cutoff window
 * (seeded booking only — UI book would refuse lead time).
 */
export function pickCutoffSlotStart(now = DateTime.now().setZone(ZONE)): {
  start: Date;
  needsNextWeek: boolean;
} {
  const weekEnd = now.endOf("week");
  let candidate = normalizeWorkingHour(now.plus({ hours: 2 }).startOf("hour"));

  let needsNextWeek = false;
  if (candidate > weekEnd) {
    needsNextWeek = true;
    // Still keep it close enough that CUTOFF_HOURS=24 blocks cancel.
    candidate = now
      .plus({ weeks: 1 })
      .startOf("week")
      .set({ hour: 10, minute: 0, second: 0, millisecond: 0 });
    if (candidate.diff(now, "hours").hours >= CUTOFF_HOURS) {
      candidate = normalizeWorkingHour(now.plus({ hours: 3 }).startOf("hour"));
      needsNextWeek = candidate > weekEnd;
    }
  }

  // Guarantee we are inside the cutoff window: now > start - cutoff.
  const cancelDeadline = candidate.minus({ hours: CUTOFF_HOURS });
  if (now <= cancelDeadline) {
    candidate = normalizeWorkingHour(now.plus({ hours: 2 }).startOf("hour"));
    needsNextWeek = candidate > weekEnd;
  }

  return { start: candidate.toUTC().toJSDate(), needsNextWeek };
}

/**
 * Upserts a complete client + listed masseur + one free slot on massage_test.
 * Pass a suite key so parallel Playwright workers do not share the same rows.
 * Suite `cutoff` also seeds a confirmed booking already past cancel cutoff.
 */
export async function ensureBookingFixture(
  suite: BookingFixtureSuite = "book",
): Promise<BookingFixture> {
  const ids = SUITE_IDS[suite];
  const prisma = testPrisma();
  const passwordHash = await hash(CLIENT_PASSWORD, 12);
  const picked =
    suite === "cutoff" ? pickCutoffSlotStart() : pickBookableSlotStart();
  const { start, needsNextWeek } = picked;
  const end = new Date(start.getTime() + SLOT_MS);
  const masseurName = suiteMasseurName(suite);
  const cancelCutoffHours = suite === "cutoff" ? CUTOFF_HOURS : LEAD_HOURS;

  try {
    const client = await prisma.user.upsert({
      where: { email_portal: { email: ids.clientEmail, portal: "client" } },
      create: {
        email: ids.clientEmail,
        portal: "client",
        name: "E2E Client",
        phone: ids.clientPhone,
        passwordHash,
        emailVerified: new Date(),
        cityPlaceId: "e2e-place-kyiv",
        cityCountryCode: "UA",
        cityNameEn: "Kyiv",
        cityNameUk: "Київ",
        preferredLocale: "en",
      },
      update: {
        name: "E2E Client",
        phone: ids.clientPhone,
        passwordHash,
        emailVerified: new Date(),
        cityPlaceId: "e2e-place-kyiv",
        cityCountryCode: "UA",
        cityNameEn: "Kyiv",
        cityNameUk: "Київ",
        deletedAt: null,
        blockedAt: null,
        preferredLocale: "en",
      },
      select: { id: true, name: true, phone: true },
    });

    const masseur = await prisma.user.upsert({
      where: { email_portal: { email: ids.masseurEmail, portal: "masseur" } },
      create: {
        email: ids.masseurEmail,
        portal: "masseur",
        slug: ids.slug,
        nameEn: masseurName,
        nameUk: masseurName,
        phone: ids.masseurPhone,
        emailVerified: new Date(),
        cityPlaceId: "e2e-place-kyiv",
        cityCountryCode: "UA",
        cityNameEn: "Kyiv",
        cityNameUk: "Київ",
        address: "1 E2E Street",
        timezone: ZONE,
        bookingLeadHours: LEAD_HOURS,
        cancelCutoffHours,
        massageTypes: "[]",
        preferredLocale: "en",
      },
      update: {
        slug: ids.slug,
        nameEn: masseurName,
        nameUk: masseurName,
        phone: ids.masseurPhone,
        emailVerified: new Date(),
        cityPlaceId: "e2e-place-kyiv",
        cityCountryCode: "UA",
        cityNameEn: "Kyiv",
        cityNameUk: "Київ",
        address: "1 E2E Street",
        timezone: ZONE,
        bookingLeadHours: LEAD_HOURS,
        cancelCutoffHours,
        massageTypes: "[]",
        deletedAt: null,
        blockedAt: null,
        preferredLocale: "en",
      },
      select: { id: true },
    });

    await prisma.booking.deleteMany({
      where: {
        OR: [{ masseurId: masseur.id }, { clientUserId: client.id }],
      },
    });
    await prisma.availabilitySlot.deleteMany({
      where: { masseurId: masseur.id },
    });
    await prisma.availabilitySlot.create({
      data: {
        masseurId: masseur.id,
        start,
        end,
      },
    });

    if (suite === "cutoff") {
      await prisma.booking.create({
        data: {
          masseurId: masseur.id,
          clientUserId: client.id,
          clientName: client.name ?? "E2E Client",
          clientPhone: client.phone ?? ids.clientPhone,
          slotStart: start,
          status: "confirmed",
        },
      });
    }

    return {
      clientPhone: ids.clientPhone,
      clientPassword: CLIENT_PASSWORD,
      masseurSlug: ids.slug,
      masseurName,
      masseurPhone: ids.masseurPhone,
      slotStartIso: start.toISOString(),
      needsNextWeek,
    };
  } finally {
    await prisma.$disconnect();
  }
}
