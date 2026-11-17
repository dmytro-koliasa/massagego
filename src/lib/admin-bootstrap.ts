import "server-only";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";

/**
 * Ensures a single admin User exists from env (idempotent).
 * No email verification. Safe to call on every admin login page load.
 */
export async function ensureAdminBootstrap(): Promise<void> {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || !password) return;

  const existing = await prisma.user.findFirst({
    where: { portal: "admin", deletedAt: null },
    select: { id: true },
  });
  if (existing) return;

  const byEmail = await prisma.user.findUnique({
    where: { email_portal: { email, portal: "admin" } },
    select: { id: true, deletedAt: true },
  });
  if (byEmail && !byEmail.deletedAt) return;

  const passwordHash = await hash(password, 12);
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
