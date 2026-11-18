import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { DateTime } from "luxon";

const ZONE = "Europe/Kyiv";

type ComplaintSuite = "resolve" | "dismiss";

const SUITE: Record<
  ComplaintSuite,
  {
    clientEmail: string;
    clientPhone: string;
    masseurEmail: string;
    masseurPhone: string;
    slug: string;
    clientName: string;
    masseurName: string;
    body: string;
  }
> = {
  resolve: {
    clientEmail: "e2e-client-admin-complaint@test.local",
    clientPhone: "+380501000027",
    masseurEmail: "e2e-masseur-admin-complaint@test.local",
    masseurPhone: "+380501000028",
    slug: "e2e-admin-complaint-masseur",
    clientName: "E2E Admin Complaint Client",
    masseurName: "E2E Admin Complaint Masseur",
    body: "E2E open complaint for admin resolve.",
  },
  dismiss: {
    clientEmail: "e2e-client-admin-dismiss@test.local",
    clientPhone: "+380501000029",
    masseurEmail: "e2e-masseur-admin-dismiss@test.local",
    masseurPhone: "+380501000030",
    slug: "e2e-admin-dismiss-masseur",
    clientName: "E2E Admin Dismiss Client",
    masseurName: "E2E Admin Dismiss Masseur",
    body: "E2E open complaint for admin dismiss.",
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

/** Seeds an open client→masseur complaint linked to a confirmed booking. */
export async function ensureOpenComplaint(
  suite: ComplaintSuite = "resolve",
): Promise<{
  complaintId: string;
  body: string;
}> {
  const ids = SUITE[suite];
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
      where: { email_portal: { email: ids.clientEmail, portal: "client" } },
      create: {
        email: ids.clientEmail,
        portal: "client",
        name: ids.clientName,
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
        name: ids.clientName,
        phone: ids.clientPhone,
        passwordHash,
        deletedAt: null,
        blockedAt: null,
      },
      select: { id: true, name: true, phone: true },
    });

    const masseur = await prisma.user.upsert({
      where: { email_portal: { email: ids.masseurEmail, portal: "masseur" } },
      create: {
        email: ids.masseurEmail,
        portal: "masseur",
        slug: ids.slug,
        nameEn: ids.masseurName,
        nameUk: ids.masseurName,
        phone: ids.masseurPhone,
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
        slug: ids.slug,
        nameEn: ids.masseurName,
        nameUk: ids.masseurName,
        phone: ids.masseurPhone,
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
        clientName: client.name ?? ids.clientName,
        clientPhone: client.phone ?? ids.clientPhone,
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
        body: ids.body,
        status: "open",
      },
      select: { id: true },
    });

    return { complaintId: complaint.id, body: ids.body };
  } finally {
    await prisma.$disconnect();
  }
}
