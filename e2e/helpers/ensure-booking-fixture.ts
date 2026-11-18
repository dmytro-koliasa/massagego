import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { DateTime } from "luxon";

const ZONE = "Europe/Kyiv";
const LEAD_HOURS = 1;
const CUTOFF_HOURS = 24;
/** Shorter cutoff so a ±1h Thai pair can sit on opposite sides of the window. */
const THAI_CUTOFF_HOURS = 4;
const SLOT_MS = 60 * 60 * 1000;
const CLIENT_PASSWORD = "E2eClient123!";
const MASSEUR_PASSWORD = "E2eMasseur123!";

export type BookingFixtureSuite =
  | "book"
  | "cancel"
  | "cutoff"
  | "thai"
  | "thaiCutoff"
  | "masseurResolve"
  | "masseurUnavailable"
  | "masseurWalkIn"
  | "complaint"
  | "sessionsCancel"
  | "masseurReport"
  | "slotUnavailable"
  | "inbox"
  | "bulkCancel"
  | "slotDeepLink";

export type BookingFixture = {
  clientPhone: string;
  clientPassword: string;
  masseurEmail: string;
  masseurPassword: string;
  masseurSlug: string;
  masseurName: string;
  masseurPhone: string;
  /** Seeded booking id when the suite creates a confirmed booking. */
  bookingId?: string;
  /** For thaiCutoff: the cancellable (later) slot the test should click. */
  slotStartIso: string;
  /** Earlier consecutive hour (inside cutoff for thaiCutoff). */
  neighborSlotStartIso?: string;
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
  thai: {
    clientEmail: "e2e-client-thai@test.local",
    clientPhone: "+380501000007",
    masseurEmail: "e2e-masseur-thai@test.local",
    masseurPhone: "+380501000008",
    slug: "e2e-thai-masseur",
  },
  thaiCutoff: {
    clientEmail: "e2e-client-thai-cutoff@test.local",
    clientPhone: "+380501000009",
    masseurEmail: "e2e-masseur-thai-cutoff@test.local",
    masseurPhone: "+380501000010",
    slug: "e2e-thai-cutoff-masseur",
  },
  masseurResolve: {
    clientEmail: "e2e-client-masseur-resolve@test.local",
    clientPhone: "+380501000011",
    masseurEmail: "e2e-masseur-resolve@test.local",
    masseurPhone: "+380501000012",
    slug: "e2e-masseur-resolve",
  },
  masseurUnavailable: {
    clientEmail: "e2e-client-masseur-unavailable@test.local",
    clientPhone: "+380501000013",
    masseurEmail: "e2e-masseur-unavailable@test.local",
    masseurPhone: "+380501000014",
    slug: "e2e-masseur-unavailable",
  },
  masseurWalkIn: {
    clientEmail: "e2e-client-masseur-walkin@test.local",
    clientPhone: "+380501000015",
    masseurEmail: "e2e-masseur-walkin@test.local",
    masseurPhone: "+380501000016",
    slug: "e2e-masseur-walkin",
  },
  complaint: {
    clientEmail: "e2e-client-complaint@test.local",
    clientPhone: "+380501000017",
    masseurEmail: "e2e-masseur-complaint@test.local",
    masseurPhone: "+380501000018",
    slug: "e2e-complaint-masseur",
  },
  sessionsCancel: {
    clientEmail: "e2e-client-sessions-cancel@test.local",
    clientPhone: "+380501000019",
    masseurEmail: "e2e-masseur-sessions-cancel@test.local",
    masseurPhone: "+380501000020",
    slug: "e2e-sessions-cancel-masseur",
  },
  masseurReport: {
    clientEmail: "e2e-client-masseur-report@test.local",
    clientPhone: "+380501000023",
    masseurEmail: "e2e-masseur-report@test.local",
    masseurPhone: "+380501000024",
    slug: "e2e-masseur-report",
  },
  slotUnavailable: {
    clientEmail: "e2e-client-slot-unavailable@test.local",
    clientPhone: "+380501000025",
    masseurEmail: "e2e-masseur-slot-unavailable@test.local",
    masseurPhone: "+380501000026",
    slug: "e2e-slot-unavailable",
  },
  inbox: {
    clientEmail: "e2e-client-inbox@test.local",
    clientPhone: "+380501000031",
    masseurEmail: "e2e-masseur-inbox@test.local",
    masseurPhone: "+380501000032",
    slug: "e2e-inbox-masseur",
  },
  bulkCancel: {
    clientEmail: "e2e-client-bulk-cancel@test.local",
    clientPhone: "+380501000033",
    masseurEmail: "e2e-masseur-bulk-cancel@test.local",
    masseurPhone: "+380501000034",
    slug: "e2e-bulk-cancel-masseur",
  },
  slotDeepLink: {
    clientEmail: "e2e-client-slot-deeplink@test.local",
    clientPhone: "+380501000035",
    masseurEmail: "e2e-masseur-slot-deeplink@test.local",
    masseurPhone: "+380501000036",
    slug: "e2e-slot-deeplink-masseur",
  },
};

function suiteMasseurName(suite: BookingFixtureSuite) {
  if (suite === "cancel") return "E2E Cancel Masseur";
  if (suite === "cutoff") return "E2E Cutoff Masseur";
  if (suite === "thai") return "E2E Thai Masseur";
  if (suite === "thaiCutoff") return "E2E Thai Cutoff Masseur";
  if (suite === "masseurResolve") return "E2E Resolve Masseur";
  if (suite === "masseurUnavailable") return "E2E Unavailable Masseur";
  if (suite === "masseurWalkIn") return "E2E Walk-in Masseur";
  if (suite === "complaint") return "E2E Complaint Masseur";
  if (suite === "sessionsCancel") return "E2E Sessions Cancel Masseur";
  if (suite === "masseurReport") return "E2E Report Masseur";
  if (suite === "slotUnavailable") return "E2E Slot Unavailable Masseur";
  if (suite === "inbox") return "E2E Inbox Masseur";
  if (suite === "bulkCancel") return "E2E Bulk Cancel Masseur";
  if (suite === "slotDeepLink") return "E2E Slot Deep Link Masseur";
  return "E2E Booking Masseur";
}

function seedsConfirmedBooking(suite: BookingFixtureSuite) {
  return (
    suite === "cutoff" ||
    suite === "masseurResolve" ||
    suite === "masseurUnavailable" ||
    suite === "complaint" ||
    suite === "sessionsCancel" ||
    suite === "masseurReport" ||
    suite === "bulkCancel"
  );
}

function canCancelSlot(
  slotLocal: DateTime,
  now: DateTime,
  cutoffHours: number,
) {
  return now.toMillis() <= slotLocal.minus({ hours: cutoffHours }).toMillis();
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

/** Two consecutive bookable hours (neighbour still inside 05–22 local). */
export function pickThaiPairStarts(now = DateTime.now().setZone(ZONE)): {
  start: Date;
  neighbor: Date;
  needsNextWeek: boolean;
} {
  let { start, needsNextWeek } = pickBookableSlotStart(now);
  let local = DateTime.fromJSDate(start, { zone: "utc" }).setZone(ZONE);
  if (local.hour >= 22) {
    local = normalizeWorkingHour(
      local.plus({ days: 1 }).set({ hour: 10, minute: 0, second: 0, millisecond: 0 }),
    );
    const earliest = now.plus({ hours: LEAD_HOURS });
    while (local <= earliest) {
      local = normalizeWorkingHour(local.plus({ hours: 1 }));
    }
    needsNextWeek = local > now.endOf("week");
    start = local.toUTC().toJSDate();
  }
  const neighbor = new Date(start.getTime() + SLOT_MS);
  return { start, neighbor, needsNextWeek };
}

/**
 * Earlier hour already inside cancel cutoff; later hour still cancellable.
 * Returns `start` = cancellable (click target), `neighbor` = cutoff neighbour.
 */
export function pickThaiCutoffPairStarts(
  now = DateTime.now().setZone(ZONE),
  cutoffHours = THAI_CUTOFF_HOURS,
): {
  start: Date;
  neighbor: Date;
  needsNextWeek: boolean;
} {
  let neighborLocal = now
    .plus({ hours: Math.max(cutoffHours - 1, 1) })
    .startOf("hour");
  let cancelLocal = neighborLocal.plus({ hours: 1 });

  for (let step = 0; step < 48; step += 1) {
    neighborLocal = normalizeWorkingHour(neighborLocal);
    cancelLocal = neighborLocal.plus({ hours: 1 });
    const hoursOk =
      neighborLocal.hour >= 5 &&
      neighborLocal.hour <= 21 &&
      cancelLocal.hour >= 5 &&
      cancelLocal.hour <= 22;
    if (
      hoursOk &&
      !canCancelSlot(neighborLocal, now, cutoffHours) &&
      canCancelSlot(cancelLocal, now, cutoffHours)
    ) {
      break;
    }
    neighborLocal = neighborLocal.plus({ hours: 1 });
  }

  const needsNextWeek =
    neighborLocal > now.endOf("week") || cancelLocal > now.endOf("week");
  return {
    start: cancelLocal.toUTC().toJSDate(),
    neighbor: neighborLocal.toUTC().toJSDate(),
    needsNextWeek,
  };
}

/**
 * Upserts a complete client + listed masseur + one free slot on massage_test.
 * Pass a suite key so parallel Playwright workers do not share the same rows.
 * Suite `cutoff` seeds a booking already past cancel cutoff.
 * Suite `thai` seeds two consecutive Thai bookings for X-1 neighbour hints.
 * Suite `thaiCutoff` seeds a cancellable Thai hour next to a neighbour already past cutoff.
 * Suite `masseurResolve` seeds a confirmed booking for the masseur resolve (Make available) path.
 * Suite `masseurUnavailable` seeds a confirmed booking for Make unavailable.
 * Suite `masseurWalkIn` / `slotUnavailable` seed a free published slot (no booking row).
 * Suites `complaint`, `sessionsCancel`, `masseurReport` seed a confirmed account booking.
 * Suite `inbox` seeds a free published slot for the in-app notification happy path.
 * Suite `bulkCancel` seeds a confirmed booking for masseur bulk-cancel (X-4).
 * Suite `slotDeepLink` seeds a client-cancelled booking + free slot for AR-24 deep-link.
 */
export async function ensureBookingFixture(
  suite: BookingFixtureSuite = "book",
): Promise<BookingFixture> {
  const ids = SUITE_IDS[suite];
  const prisma = testPrisma();
  const clientPasswordHash = await hash(CLIENT_PASSWORD, 12);
  const masseurPasswordHash = await hash(MASSEUR_PASSWORD, 12);
  const thaiPair =
    suite === "thai"
      ? pickThaiPairStarts()
      : suite === "thaiCutoff"
        ? pickThaiCutoffPairStarts()
        : null;
  const picked =
    suite === "cutoff"
      ? pickCutoffSlotStart()
      : thaiPair
        ? { start: thaiPair.start, needsNextWeek: thaiPair.needsNextWeek }
        : pickBookableSlotStart();
  const { start, needsNextWeek } = picked;
  const neighborStart = thaiPair?.neighbor;
  const end = new Date(start.getTime() + SLOT_MS);
  const masseurName = suiteMasseurName(suite);
  const cancelCutoffHours =
    suite === "cutoff"
      ? CUTOFF_HOURS
      : suite === "thaiCutoff"
        ? THAI_CUTOFF_HOURS
        : LEAD_HOURS;
  const massageTypes =
    suite === "thai" || suite === "thaiCutoff" ? '["thai"]' : "[]";

  try {
    const client = await prisma.user.upsert({
      where: { email_portal: { email: ids.clientEmail, portal: "client" } },
      create: {
        email: ids.clientEmail,
        portal: "client",
        name: "E2E Client",
        phone: ids.clientPhone,
        passwordHash: clientPasswordHash,
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
        passwordHash: clientPasswordHash,
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
        passwordHash: masseurPasswordHash,
        emailVerified: new Date(),
        cityPlaceId: "e2e-place-kyiv",
        cityCountryCode: "UA",
        cityNameEn: "Kyiv",
        cityNameUk: "Київ",
        address: "1 E2E Street",
        timezone: ZONE,
        bookingLeadHours: LEAD_HOURS,
        cancelCutoffHours,
        massageTypes,
        preferredLocale: "en",
      },
      update: {
        slug: ids.slug,
        nameEn: masseurName,
        nameUk: masseurName,
        phone: ids.masseurPhone,
        passwordHash: masseurPasswordHash,
        emailVerified: new Date(),
        cityPlaceId: "e2e-place-kyiv",
        cityCountryCode: "UA",
        cityNameEn: "Kyiv",
        cityNameUk: "Київ",
        address: "1 E2E Street",
        timezone: ZONE,
        bookingLeadHours: LEAD_HOURS,
        cancelCutoffHours,
        massageTypes,
        deletedAt: null,
        blockedAt: null,
        preferredLocale: "en",
      },
      select: { id: true },
    });

    await prisma.complaint.deleteMany({
      where: {
        OR: [{ reporterId: client.id }, { targetId: masseur.id }, { targetId: client.id }, { reporterId: masseur.id }],
      },
    });
    await prisma.inAppNotification.deleteMany({
      where: {
        OR: [{ userId: client.id }, { userId: masseur.id }],
      },
    });
    await prisma.booking.deleteMany({
      where: {
        OR: [{ masseurId: masseur.id }, { clientUserId: client.id }],
      },
    });
    await prisma.availabilitySlot.deleteMany({
      where: { masseurId: masseur.id },
    });
    // Avoid flaky auth/booking 429s across repeated local Playwright runs.
    await prisma.rateLimitBucket.deleteMany({
      where: {
        OR: [
          { key: { contains: ids.clientPhone } },
          { key: { contains: ids.clientEmail } },
          { key: { contains: ids.masseurEmail } },
          { key: { contains: ids.masseurPhone } },
        ],
      },
    });

    const slotRows = [
      { masseurId: masseur.id, start, end },
      ...(neighborStart
        ? [
            {
              masseurId: masseur.id,
              start: neighborStart,
              end: new Date(neighborStart.getTime() + SLOT_MS),
            },
          ]
        : []),
    ];
    await prisma.availabilitySlot.createMany({ data: slotRows });

    let bookingId: string | undefined;
    if (seedsConfirmedBooking(suite)) {
      const booking = await prisma.booking.create({
        data: {
          masseurId: masseur.id,
          clientUserId: client.id,
          clientName: client.name ?? "E2E Client",
          clientPhone: client.phone ?? ids.clientPhone,
          slotStart: start,
          status: "confirmed",
        },
        select: { id: true },
      });
      bookingId = booking.id;
    }

    if ((suite === "thai" || suite === "thaiCutoff") && neighborStart) {
      const shared = {
        masseurId: masseur.id,
        clientUserId: client.id,
        clientName: client.name ?? "E2E Client",
        clientPhone: client.phone ?? ids.clientPhone,
        massageType: "thai",
        status: "confirmed" as const,
      };
      await prisma.booking.createMany({
        data: [
          { ...shared, slotStart: start },
          { ...shared, slotStart: neighborStart },
        ],
      });
    }

    if (suite === "slotDeepLink") {
      const booking = await prisma.booking.create({
        data: {
          masseurId: masseur.id,
          clientUserId: client.id,
          clientName: client.name ?? "E2E Client",
          clientPhone: client.phone ?? ids.clientPhone,
          slotStart: start,
          status: "cancelled",
          cancelledBy: "client",
          cancelledAt: new Date(),
          cancelReason: "cant_make_it",
        },
        select: { id: true },
      });
      bookingId = booking.id;
    }

    return {
      clientPhone: ids.clientPhone,
      clientPassword: CLIENT_PASSWORD,
      masseurEmail: ids.masseurEmail,
      masseurPassword: MASSEUR_PASSWORD,
      masseurSlug: ids.slug,
      masseurName,
      masseurPhone: ids.masseurPhone,
      bookingId,
      slotStartIso: start.toISOString(),
      neighborSlotStartIso: neighborStart?.toISOString(),
      needsNextWeek,
    };
  } finally {
    await prisma.$disconnect();
  }
}
