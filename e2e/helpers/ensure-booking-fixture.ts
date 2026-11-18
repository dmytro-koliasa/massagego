import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { DateTime } from "luxon";

const ZONE = "Europe/Kyiv";
const LEAD_HOURS = 1;
const SLOT_MS = 60 * 60 * 1000;
const CLIENT_PASSWORD = "E2eClient123!";

export type BookingFixtureSuite = "book" | "cancel";

export type BookingFixture = {
  clientPhone: string;
  clientPassword: string;
  masseurSlug: string;
  masseurName: string;
  slotStartIso: string;
  needsNextWeek: boolean;
};

const SUITE_IDS: Record<
  BookingFixtureSuite,
  { clientEmail: string; clientPhone: string; masseurEmail: string; masseurPhone: string; slug: string }
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
};

function testPrisma() {
  const databaseUrl =
    process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  return new PrismaClient(
    databaseUrl
      ? { datasources: { db: { url: databaseUrl } } }
      : undefined,
  );
}

/** Next hour-aligned slot past lead time, preferably still in the current ISO week. */
export function pickBookableSlotStart(now = DateTime.now().setZone(ZONE)): {
  start: Date;
  needsNextWeek: boolean;
} {
  const weekEnd = now.endOf("week");
  let candidate = now.plus({ hours: LEAD_HOURS + 1 }).startOf("hour");

  if (candidate.hour < 5) {
    candidate = candidate.set({ hour: 10, minute: 0, second: 0, millisecond: 0 });
  }
  if (candidate.hour >= 23) {
    candidate = candidate
      .plus({ days: 1 })
      .set({ hour: 10, minute: 0, second: 0, millisecond: 0 });
  }

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
    candidate = candidate.plus({ hours: 1 });
    if (candidate.hour >= 23) {
      candidate = candidate
        .plus({ days: 1 })
        .set({ hour: 10, minute: 0, second: 0, millisecond: 0 });
    }
  }

  return { start: candidate.toUTC().toJSDate(), needsNextWeek };
}

/**
 * Upserts a complete client + listed masseur + one free slot on massage_test.
 * Pass a suite key so parallel Playwright workers do not share the same rows.
 */
export async function ensureBookingFixture(
  suite: BookingFixtureSuite = "book",
): Promise<BookingFixture> {
  const ids = SUITE_IDS[suite];
  const prisma = testPrisma();
  const passwordHash = await hash(CLIENT_PASSWORD, 12);
  const { start, needsNextWeek } = pickBookableSlotStart();
  const end = new Date(start.getTime() + SLOT_MS);
  const masseurName =
    suite === "cancel" ? "E2E Cancel Masseur" : "E2E Booking Masseur";

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
      select: { id: true },
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
        // Match lead so bookable slots stay inside the client cancel window.
        cancelCutoffHours: LEAD_HOURS,
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
        cancelCutoffHours: LEAD_HOURS,
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

    return {
      clientPhone: ids.clientPhone,
      clientPassword: CLIENT_PASSWORD,
      masseurSlug: ids.slug,
      masseurName,
      slotStartIso: start.toISOString(),
      needsNextWeek,
    };
  } finally {
    await prisma.$disconnect();
  }
}
