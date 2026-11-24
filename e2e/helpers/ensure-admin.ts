import { hash } from "bcryptjs";
import { createE2EPrismaClient } from "./prisma";

/**
 * Upserts the bootstrap admin on the test DB so E2E login always matches
 * ADMIN_BOOTSTRAP_* (ensureAdminBootstrap does not rotate an existing password).
 */
export async function ensureAdminForE2E(): Promise<{
  email: string;
  password: string;
}> {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD are required for admin E2E",
    );
  }

  const prisma = createE2EPrismaClient();

  try {
    const passwordHash = await hash(password, 12);
    const existing = await prisma.user.findUnique({
      where: { email_portal: { email, portal: "admin" } },
      select: { id: true },
    });

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          deletedAt: null,
          blockedAt: null,
          emailVerified: new Date(),
        },
      });
    } else {
      await prisma.user.create({
        data: {
          email,
          passwordHash,
          portal: "admin",
          emailVerified: new Date(),
          preferredLocale: "en",
          name: "Administrator",
        },
      });
    }

    return { email, password };
  } finally {
    await prisma.$disconnect();
  }
}
