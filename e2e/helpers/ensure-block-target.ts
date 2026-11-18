import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const CLIENT_EMAIL = "e2e-client-admin-block@test.local";
const CLIENT_PHONE = "+380501000021";
const CLIENT_PASSWORD = "E2eClient123!";
const CLIENT_NAME = "E2E Block Client";

function testPrisma() {
  const databaseUrl =
    process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  return new PrismaClient(
    databaseUrl
      ? { datasources: { db: { url: databaseUrl } } }
      : undefined,
  );
}

/** Upserts an unblocked client for admin block/unblock E2E. */
export async function ensureBlockTargetClient(): Promise<{
  id: string;
  email: string;
  phone: string;
  password: string;
  name: string;
}> {
  const prisma = testPrisma();
  const passwordHash = await hash(CLIENT_PASSWORD, 12);

  try {
    const client = await prisma.user.upsert({
      where: { email_portal: { email: CLIENT_EMAIL, portal: "client" } },
      create: {
        email: CLIENT_EMAIL,
        portal: "client",
        name: CLIENT_NAME,
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
        name: CLIENT_NAME,
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

    await prisma.rateLimitBucket.deleteMany({
      where: {
        OR: [
          { key: { contains: CLIENT_PHONE } },
          { key: { contains: CLIENT_EMAIL } },
        ],
      },
    });

    return {
      id: client.id,
      email: CLIENT_EMAIL,
      phone: CLIENT_PHONE,
      password: CLIENT_PASSWORD,
      name: CLIENT_NAME,
    };
  } finally {
    await prisma.$disconnect();
  }
}
