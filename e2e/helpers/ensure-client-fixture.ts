import { hash } from "bcryptjs";
import { createE2EPrismaClient } from "./prisma";

const CLIENT_PASSWORD = "E2eClient123!";

function testPrisma() {
  return createE2EPrismaClient();
}

export type ClientFixture = {
  phone: string;
  email: string;
  password: string;
  name: string;
};

/** Disposable client for delete-account E2E (no UI register). */
export async function ensureDeleteClientFixture(): Promise<ClientFixture> {
  const prisma = testPrisma();
  const stamp = `${Date.now()}`.slice(-7);
  const email = `e2e-client-delete-${stamp}@test.local`;
  const phone = `+38050${stamp.padStart(7, "0")}`;
  const name = "E2E Delete Client";
  const passwordHash = await hash(CLIENT_PASSWORD, 12);

  try {
    await prisma.user.upsert({
      where: { email_portal: { email, portal: "client" } },
      create: {
        email,
        portal: "client",
        name,
        phone,
        passwordHash,
        emailVerified: new Date(),
        cityPlaceId: "e2e-place-kyiv",
        cityCountryCode: "UA",
        cityNameEn: "Kyiv",
        cityNameUk: "Київ",
        preferredLocale: "en",
      },
      update: {
        name,
        phone,
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
    });

    await prisma.rateLimitBucket.deleteMany({
      where: {
        OR: [
          { key: { contains: phone } },
          { key: { contains: email } },
          { key: { startsWith: "signin:ip:" } },
          { key: { startsWith: "register:ip:" } },
          { key: { startsWith: "geocode:ip:" } },
        ],
      },
    });

    return { phone, email, password: CLIENT_PASSWORD, name };
  } finally {
    await prisma.$disconnect();
  }
}
