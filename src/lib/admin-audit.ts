import "server-only";
import { prisma } from "@/lib/prisma";

export async function writeAdminAuditLog(options: {
  actorUserId: string;
  action: string;
  targetUserId?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  await prisma.adminAuditLog.create({
    data: {
      actorUserId: options.actorUserId,
      action: options.action,
      targetUserId: options.targetUserId ?? null,
      metaJson: options.meta ? JSON.stringify(options.meta) : null,
    },
  });
}
