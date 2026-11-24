import { PrismaClient } from "@prisma/client";

/**
 * Wipe shared IP auth/geocode budgets on massage_test so a long Playwright
 * smoke list does not trip sign-in (10/15m) or register IP ceilings.
 */
export async function clearAuthRateLimits() {
  const databaseUrl =
    process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  const prisma = new PrismaClient(
    databaseUrl
      ? { datasources: { db: { url: databaseUrl } } }
      : undefined,
  );
  try {
    await prisma.rateLimitBucket.deleteMany({
      where: {
        OR: [
          { key: { startsWith: "signin:ip:" } },
          { key: { startsWith: "register:ip:" } },
          { key: { startsWith: "geocode:ip:" } },
        ],
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}
