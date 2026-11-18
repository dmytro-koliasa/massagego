import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { DateTime } from "luxon";

const ZONE = "Europe/Kyiv";
const LEAD_HOURS = 1;
const SLOT_MS = 60 * 60 * 1000;

const CLIENT_EMAIL = "e2e-client@test.local";
const CLIENT_PHONE = "+380501000001";
const CLIENT_PASSWORD = "E2eClient123!";

const MASSEUR_EMAIL = "e2e-masseur@test.local";
const MASSEUR_PHONE = "+380501000002";
const MASSEUR_SLUG = "e2e-booking-masseur";

export type BookingFixture = {
  clientPhone: string;
  clientPassword: string;
  masseurSlug: string;
  masseurName: string;
  slotStartIso: string;
  needsNextWeek: boolean;
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
 */
export async function ensureBookingFixture(): Promise<BookingFixture> {
  const prisma = testPrisma();
  const passwordHash = await hash(CLIENT_PASSWORD, 12);
  const { start, needsNextWeek } = pickBookableSlotStart();
  const end = new Date(start.getTime() + SLOT_MS);
  const masseurName = "E2E Booking Masseur";

  try {
    const client = await prisma.user.upsert({
      where: { email_portal: { email: CLIENT_EMAIL, portal: "client" } },
      create: {
        email: CLIENT_EMAIL,
        portal: "client",
        name: "E2E Client",
        phone: CLIENT_PHONE,
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
        phone: CLIENT_PHONE,
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
      where: { email_portal: { email: MASSEUR_EMAIL, portal: "masseur" } },
      create: {
        email: MASSEUR_EMAIL,
        portal: "masseur",
        slug: MASSEUR_SLUG,
        nameEn: masseurName,
        nameUk: masseurName,
        phone: MASSEUR_PHONE,
        emailVerified: new Date(),
        cityPlaceId: "e2e-place-kyiv",
        cityCountryCode: "UA",
        cityNameEn: "Kyiv",
        cityNameUk: "Київ",
        address: "1 E2E Street",
        timezone: ZONE,
        bookingLeadHours: LEAD_HOURS,
        cancelCutoffHours: 24,
        massageTypes: "[]",
        preferredLocale: "en",
      },
      update: {
        slug: MASSEUR_SLUG,
        nameEn: masseurName,
        nameUk: masseurName,
        phone: MASSEUR_PHONE,
        emailVerified: new Date(),
        cityPlaceId: "e2e-place-kyiv",
        cityCountryCode: "UA",
        cityNameEn: "Kyiv",
        cityNameUk: "Київ",
        address: "1 E2E Street",
        timezone: ZONE,
        bookingLeadHours: LEAD_HOURS,
        cancelCutoffHours: 24,
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
      clientPhone: CLIENT_PHONE,
      clientPassword: CLIENT_PASSWORD,
      masseurSlug: MASSEUR_SLUG,
      masseurName,
      slotStartIso: start.toISOString(),
      needsNextWeek,
    };
  } finally {
    await prisma.$disconnect();
  }
}
