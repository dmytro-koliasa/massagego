import "server-only";
import { compare, hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";

export type ChangeAdminPasswordResult =
  | { ok: true }
  | { ok: false; error: "unauthorized" | "invalid_current" | "same_password" };

/**
 * Signed-in admin password change (#137). Bumps `passwordChangedAt` so other
 * admin JWTs become stale via the existing #79 credential-version check.
 */
export async function changeAdminPassword(options: {
  adminUserId: string;
  currentPassword: string;
  newPassword: string;
}): Promise<ChangeAdminPasswordResult> {
  const user = await prisma.user.findFirst({
    where: {
      id: options.adminUserId,
      portal: "admin",
      deletedAt: null,
      blockedAt: null,
    },
    select: { id: true, passwordHash: true },
  });
  if (!user?.passwordHash) {
    return { ok: false, error: "unauthorized" };
  }

  const currentOk = await compare(options.currentPassword, user.passwordHash);
  if (!currentOk) {
    return { ok: false, error: "invalid_current" };
  }

  if (options.currentPassword === options.newPassword) {
    return { ok: false, error: "same_password" };
  }

  const passwordHash = await hash(options.newPassword, 12);
  const passwordChangedAt = new Date();
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, passwordChangedAt },
  });
  return { ok: true };
}
