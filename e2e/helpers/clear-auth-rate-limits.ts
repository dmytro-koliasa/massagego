import { createE2EPrismaClient } from "./prisma";

/**
 * Wipe shared auth/geocode budgets on massage_test so a parallel Playwright
 * suite does not trip sign-in (10/15m IP), password-fail, or register ceilings.
 * Does not change production rate-limit policy — test-DB isolation only.
 */
export async function clearAuthRateLimits() {
  const prisma = createE2EPrismaClient();
  try {
    await prisma.rateLimitBucket.deleteMany({
      where: {
        OR: [
          { key: { startsWith: "signin:ip:" } },
          { key: { startsWith: "signin:fail:" } },
          { key: { startsWith: "register:ip:" } },
          { key: { startsWith: "geocode:ip:" } },
        ],
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}
