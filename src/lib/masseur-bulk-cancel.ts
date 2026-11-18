import "server-only";
import { countMasseurFutureBookings } from "@/lib/account-deletion";
import { SLOT_MS } from "@/lib/booking-constants";
import { notifyMasseurCancelledBooking } from "@/lib/notifications/outbox";
import { prisma } from "@/lib/prisma";

export { countMasseurFutureBookings };

export type BulkCancelAvailability = "available" | "unavailable";

export type BulkCancelResult =
  | {
      ok: true;
      cancelledCount: number;
      notifiedCount: number;
      availability: BulkCancelAvailability;
    }
  | { ok: false; error: "none_found" };

/**
 * Cancel all future non-started confirmed bookings for a masseur in one
 * transaction, then notify clients best-effort (X-4 / BR-011).
 */
export async function bulkCancelMasseurFutureBookings(options: {
  masseurId: string;
  availability: BulkCancelAvailability;
  now?: Date;
}): Promise<BulkCancelResult> {
  const now = options.now ?? new Date();
  const keepAvailable = options.availability === "available";

  const result = await prisma.$transaction(async (tx) => {
    const bookings = await tx.booking.findMany({
      where: {
        masseurId: options.masseurId,
        status: "confirmed",
        slotStart: { gt: now },
      },
      select: { id: true, slotStart: true, clientUserId: true },
      orderBy: { slotStart: "asc" },
    });

    if (bookings.length === 0) {
      return { cancelledIds: [] as string[], notifyIds: [] as string[] };
    }

    const cancelledAt = now;
    await tx.booking.updateMany({
      where: { id: { in: bookings.map((row) => row.id) } },
      data: {
        status: "cancelled",
        cancelledBy: "masseur",
        cancelledAt,
      },
    });

    for (const booking of bookings) {
      if (!booking.slotStart) continue;
      const slotStart = booking.slotStart;
      const slotEnd = new Date(slotStart.getTime() + SLOT_MS);

      if (keepAvailable) {
        await tx.availabilitySlot.upsert({
          where: {
            masseurId_start: {
              masseurId: options.masseurId,
              start: slotStart,
            },
          },
          create: {
            masseurId: options.masseurId,
            start: slotStart,
            end: slotEnd,
          },
          update: { end: slotEnd },
        });
      } else {
        await tx.availabilitySlot.deleteMany({
          where: {
            masseurId: options.masseurId,
            start: slotStart,
          },
        });
      }
    }

    return {
      cancelledIds: bookings.map((row) => row.id),
      notifyIds: bookings
        .filter((row) => row.clientUserId)
        .map((row) => row.id),
    };
  });

  if (result.cancelledIds.length === 0) {
    return { ok: false, error: "none_found" };
  }

  let notifiedCount = 0;
  for (const bookingId of result.notifyIds) {
    try {
      await notifyMasseurCancelledBooking(bookingId);
      notifiedCount += 1;
    } catch (error) {
      console.error(
        "[masseur/bulk-cancel] notifyMasseurCancelledBooking",
        bookingId,
        error,
      );
    }
  }

  return {
    ok: true,
    cancelledCount: result.cancelledIds.length,
    notifiedCount,
    availability: options.availability,
  };
}
