import { createE2EPrismaClient } from "./prisma";

/**
 * Wipe shared IP auth/geocode budgets on massage_test so a long Playwright
 * smoke list does not trip sign-in (10/15m) or register IP ceilings.
 */
export async function clearAuthRateLimits() {
  const prisma = createE2EPrismaClient();
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
