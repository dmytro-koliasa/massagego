import "server-only";
import {
  cancelledBookingEligibleBefore,
  completedBookingEligibleBefore,
} from "@/lib/booking-cleanup-rules";
import { prisma } from "@/lib/prisma";

export {
  cancelledBookingEligibleBefore,
  completedBookingEligibleBefore,
} from "@/lib/booking-cleanup-rules";

/**
 * Hard-delete cancelled (7d) and completed (3mo) bookings without retention hold.
 * Idempotent. Logs counts only (no PII).
 */
export async function processBookingCleanup(options?: {
  limit?: number;
  now?: Date;
}): Promise<{
  deletedCancelled: number;
  deletedCompleted: number;
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

  return {
    deletedCancelled: cancelledIds.length,
    deletedCompleted: completedIds.length,
  };
}
