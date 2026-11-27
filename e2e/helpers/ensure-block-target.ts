import { hash } from "bcryptjs";
import { clearAuthRateLimits } from "./clear-auth-rate-limits";
import { createE2EPrismaClient } from "./prisma";

const CLIENT_PASSWORD = "E2eClient123!";

type BlockTargetSuite = "block" | "unblock";

const SUITE_IDS: Record<
  BlockTargetSuite,
  { email: string; phone: string; name: string }
> = {
  block: {
    email: "e2e-client-admin-block@test.local",
    phone: "+380501000021",
    name: "E2E Block Client",
  },
  unblock: {
    email: "e2e-client-admin-unblock@test.local",
    phone: "+380501000022",
    name: "E2E Unblock Client",
  },
};

function testPrisma() {
  return createE2EPrismaClient();
}

/**
 * Upserts a client for admin block/unblock E2E.
 * Suite `unblock` seeds with `blockedAt` already set.
 */
export async function ensureBlockTargetClient(
  suite: BlockTargetSuite = "block",
): Promise<{
  id: string;
  email: string;
  phone: string;
  password: string;
  name: string;
}> {
  const ids = SUITE_IDS[suite];
  const prisma = testPrisma();
  const passwordHash = await hash(CLIENT_PASSWORD, 12);
  const blockedAt = suite === "unblock" ? new Date() : null;

  try {
    const client = await prisma.user.upsert({
      where: { email_portal: { email: ids.email, portal: "client" } },
      create: {
        email: ids.email,
        portal: "client",
        name: ids.name,
        phone: ids.phone,
        passwordHash,
        emailVerified: new Date(),
        cityPlaceId: "e2e-place-kyiv",
        cityCountryCode: "UA",
        cityNameEn: "Kyiv",
        cityNameUk: "Київ",
        preferredLocale: "en",
        blockedAt,
      },
      update: {
        name: ids.name,
        phone: ids.phone,
        passwordHash,
        emailVerified: new Date(),
        cityPlaceId: "e2e-place-kyiv",
        cityCountryCode: "UA",
        cityNameEn: "Kyiv",
        cityNameUk: "Київ",
        deletedAt: null,
        blockedAt,
        preferredLocale: "en",
      },
      select: { id: true },
    });

    // Keys are hashed (`scope:sha256`); wipe shared IP/fail budgets via helper.
    await clearAuthRateLimits();

    return {
      id: client.id,
      email: ids.email,
      phone: ids.phone,
      password: CLIENT_PASSWORD,
      name: ids.name,
    };
  } finally {
    await prisma.$disconnect();
  }
}
