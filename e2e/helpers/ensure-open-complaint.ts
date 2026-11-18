import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { DateTime } from "luxon";

const ZONE = "Europe/Kyiv";
const CLIENT_EMAIL = "e2e-client-admin-complaint@test.local";
const CLIENT_PHONE = "+380501000027";
const MASSEUR_EMAIL = "e2e-masseur-admin-complaint@test.local";
const MASSEUR_PHONE = "+380501000028";
const MASSEUR_SLUG = "e2e-admin-complaint-masseur";
const BODY = "E2E open complaint for admin resolve.";

function testPrisma() {
  const databaseUrl =
    process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  return new PrismaClient(
    databaseUrl
      ? { datasources: { db: { url: databaseUrl } } }
      : undefined,
  );
}

/** Seeds an open client→masseur complaint linked to a confirmed booking. */
export async function ensureOpenComplaint(): Promise<{
  complaintId: string;
  body: string;
}> {
  const prisma = testPrisma();
  const passwordHash = await hash("E2eClient123!", 12);
  const slotStart = DateTime.now()
    .setZone(ZONE)
    .plus({ hours: 3 })
    .startOf("hour");
  const start = slotStart.toUTC().toJSDate();
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  try {
    const client = await prisma.user.upsert({
      where: { email_portal: { email: CLIENT_EMAIL, portal: "client" } },
      create: {
        email: CLIENT_EMAIL,
        portal: "client",
        name: "E2E Admin Complaint Client",
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
        name: "E2E Admin Complaint Client",
        phone: CLIENT_PHONE,
        passwordHash,
        deletedAt: null,
        blockedAt: null,
      },
      select: { id: true, name: true, phone: true },
    });

    const masseur = await prisma.user.upsert({
      where: { email_portal: { email: MASSEUR_EMAIL, portal: "masseur" } },
      create: {
        email: MASSEUR_EMAIL,
        portal: "masseur",
        slug: MASSEUR_SLUG,
        nameEn: "E2E Admin Complaint Masseur",
        nameUk: "E2E Admin Complaint Masseur",
        phone: MASSEUR_PHONE,
        emailVerified: new Date(),
        cityPlaceId: "e2e-place-kyiv",
        cityCountryCode: "UA",
        cityNameEn: "Kyiv",
        cityNameUk: "Київ",
        address: "1 E2E Street",
        timezone: ZONE,
        preferredLocale: "en",
      },
      update: {
        slug: MASSEUR_SLUG,
        nameEn: "E2E Admin Complaint Masseur",
        nameUk: "E2E Admin Complaint Masseur",
        phone: MASSEUR_PHONE,
        deletedAt: null,
        blockedAt: null,
      },
      select: { id: true },
    });

    await prisma.complaint.deleteMany({
      where: {
        OR: [
          { reporterId: client.id },
          { targetId: masseur.id },
          { targetId: client.id },
        ],
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

    await prisma.availabilitySlot.create({
      data: { masseurId: masseur.id, start, end },
    });
    const booking = await prisma.booking.create({
      data: {
        masseurId: masseur.id,
        clientUserId: client.id,
        clientName: client.name ?? "E2E Client",
        clientPhone: client.phone ?? CLIENT_PHONE,
        slotStart: start,
        status: "confirmed",
      },
      select: { id: true },
    });

    const complaint = await prisma.complaint.create({
      data: {
        reporterId: client.id,
        targetId: masseur.id,
        bookingId: booking.id,
        category: "rude",
        body: BODY,
        status: "open",
      },
      select: { id: true },
    });

    return { complaintId: complaint.id, body: BODY };
  } finally {
    await prisma.$disconnect();
  }
}
