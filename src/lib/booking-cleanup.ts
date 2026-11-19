import "server-only";
import {
  cancelledBookingEligibleBefore,
  completedBookingEligibleBefore,
} from "@/lib/booking-cleanup-rules";
import { deleteExpiredInAppNotifications } from "@/lib/notifications/inbox";
import { deleteExpiredOutboxRows } from "@/lib/notifications/outbox-cleanup";
import { prisma } from "@/lib/prisma";
import { deleteExpiredRateLimitBuckets } from "@/lib/rate-limit";

export {
  cancelledBookingEligibleBefore,
  completedBookingEligibleBefore,
} from "@/lib/booking-cleanup-rules";

async function runCleanupStep<T>(
  name: string,
  run: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    console.error(`[cleanup] ${name}`, error);
    return fallback;
  }
}

/**
 * Hard-delete cancelled (7d) and completed (3mo) bookings without retention hold,
 * expired in-app inbox (~30d), aged outbox rows, and idle rate-limit buckets (#81).
 * Idempotent. Logs counts only (no PII). Booking 7d/3mo policy unchanged.
 */
export async function processBookingCleanup(options?: {
  limit?: number;
  now?: Date;
}): Promise<{
  deletedCancelled: number;
  deletedCompleted: number;
  deletedInAppNotifications: number;
  deletedOutboxTerminal: number;
  deletedOutboxAbandoned: number;
  deletedRateLimitBuckets: number;
}> {
  const now = options?.now ?? new Date();
  const limit = options?.limit ?? 500;
  const cancelledBefore = cancelledBookingEligibleBefore(now);
  const completedBefore = completedBookingEligibleBefore(now);

  const cancelled = await prisma.booking.findMany({
    where: {
      status: "cancelled",
      hasRetentionHold: false,
      cancelledAt: { lte: cancelledBefore },
    },
    select: { id: true },
    take: limit,
    orderBy: { cancelledAt: "asc" },
  });

  const completed = await prisma.booking.findMany({
    where: {
      status: "confirmed",
      hasRetentionHold: false,
      slotStart: { lte: completedBefore },
    },
    select: { id: true },
    take: limit,
    orderBy: { slotStart: "asc" },
  });

  const cancelledIds = cancelled.map((row) => row.id);
  const completedIds = completed.map((row) => row.id);

  if (cancelledIds.length > 0) {
    await prisma.booking.deleteMany({ where: { id: { in: cancelledIds } } });
  }
  if (completedIds.length > 0) {
    await prisma.booking.deleteMany({ where: { id: { in: completedIds } } });
  }

  const inbox = await runCleanupStep(
    "in-app",
    () => deleteExpiredInAppNotifications({ now, limit }),
    { deleted: 0 },
  );
  const outbox = await runCleanupStep(
    "outbox",
    () => deleteExpiredOutboxRows({ now, limit }),
    { deletedTerminal: 0, deletedAbandoned: 0 },
  );
  const rateLimits = await runCleanupStep(
    "rate-limit",
    () => deleteExpiredRateLimitBuckets({ now, limit }),
    { deleted: 0 },
  );

  return {
    deletedCancelled: cancelledIds.length,
    deletedCompleted: completedIds.length,
    deletedInAppNotifications: inbox.deleted,
    deletedOutboxTerminal: outbox.deletedTerminal,
    deletedOutboxAbandoned: outbox.deletedAbandoned,
    deletedRateLimitBuckets: rateLimits.deleted,
  };
}
