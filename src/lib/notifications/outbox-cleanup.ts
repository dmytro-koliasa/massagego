import "server-only";
import {
  outboxAbandonedEligibleBefore,
  outboxTerminalEligibleBefore,
} from "@/lib/notifications/outbox-cleanup-rules";
import { prisma } from "@/lib/prisma";

/**
 * Hard-delete aged notification outbox rows (#81).
 * Does not touch bookings. Logs counts only (no PII / payloads).
 */
export async function deleteExpiredOutboxRows(options?: {
  now?: Date;
  limit?: number;
}): Promise<{ deletedTerminal: number; deletedAbandoned: number }> {
  const now = options?.now ?? new Date();
  const limit = options?.limit ?? 500;
  const terminalBefore = outboxTerminalEligibleBefore(now);
  const abandonedBefore = outboxAbandonedEligibleBefore(now);

  const terminal = await prisma.notificationOutbox.findMany({
    where: {
      OR: [
        {
          status: "sent",
          OR: [
            { sentAt: { lte: terminalBefore } },
            { sentAt: null, updatedAt: { lte: terminalBefore } },
          ],
        },
        {
          status: "dead",
          updatedAt: { lte: terminalBefore },
        },
      ],
    },
    select: { id: true },
    take: limit,
    orderBy: { updatedAt: "asc" },
  });

  const abandoned = await prisma.notificationOutbox.findMany({
    where: {
      status: { in: ["pending", "failed", "processing"] },
      createdAt: { lte: abandonedBefore },
    },
    select: { id: true },
    take: limit,
    orderBy: { createdAt: "asc" },
  });

  const terminalIds = terminal.map((row) => row.id);
  const abandonedIds = abandoned.map((row) => row.id);

  if (terminalIds.length > 0) {
    await prisma.notificationOutbox.deleteMany({
      where: { id: { in: terminalIds } },
    });
  }
  if (abandonedIds.length > 0) {
    await prisma.notificationOutbox.deleteMany({
      where: { id: { in: abandonedIds } },
    });
  }

  return {
    deletedTerminal: terminalIds.length,
    deletedAbandoned: abandonedIds.length,
  };
}
