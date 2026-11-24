import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type AuditDb = Pick<PrismaClient | Prisma.TransactionClient, "adminAuditLog">;

export async function writeAdminAuditLog(
  options: {
    actorUserId: string;
    action: string;
    targetUserId?: string | null;
    meta?: Record<string, unknown>;
  },
  db: AuditDb = prisma,
): Promise<void> {
  await db.adminAuditLog.create({
    data: {
      actorUserId: options.actorUserId,
      action: options.action,
      targetUserId: options.targetUserId ?? null,
      metaJson: options.meta ? JSON.stringify(options.meta) : null,
    },
  });
}
