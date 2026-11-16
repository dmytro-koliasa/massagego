import type { Prisma } from "@prisma/client";

/** Name of the exclusion constraint added in 20261115120000_booking_no_overlap. */
export const BOOKING_OVERLAP_CONSTRAINT = "Booking_no_overlapping_active_slots";

/** Client-hour exclusion constraint (BR-008 / 20261116220000_client_booking_no_overlap). */
export const BOOKING_CLIENT_OVERLAP_CONSTRAINT =
  "Booking_no_overlapping_active_client_slots";

/**
 * Serialise booking writes for one masseur for the rest of the transaction.
 *
 * The exclusion constraint alone is correct but, under contention, concurrent
 * inserts for the same slot can deadlock (40P01) or time out waiting on each
 * other's row locks. Taking this lock first makes contenders queue: the loser
 * then sees the winner's booking in the existence check and gets `slot_taken`.
 * The constraint remains the backstop for any code path that skips the lock.
 */
export async function lockMasseurBookings(
  tx: Pick<Prisma.TransactionClient, "$executeRaw">,
  masseurId: string,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${masseurId}, 0))`;
}

/** Serialise client booking writes so overlap/limit checks see a consistent set. */
export async function lockClientBookings(
  tx: Pick<Prisma.TransactionClient, "$executeRaw">,
  clientUserId: string,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${clientUserId}, 1))`;
}

function errorMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : null;
}

/**
 * True when the database rejected a booking because it overlaps another active
 * booking for the same masseur (Postgres exclusion violation, SQLSTATE 23P01).
 *
 * Prisma cannot map exclusion violations to a known error code: they surface as
 * `PrismaClientUnknownRequestError`, so the constraint name in the message is
 * the only reliable discriminator. P2002 is deliberately not matched: Booking
 * has no unique index, and the availability-slot upsert can also raise it.
 */
export function isBookingConflictError(error: unknown): boolean {
  const message = errorMessage(error);
  if (!message) return false;
  if (message.includes(BOOKING_CLIENT_OVERLAP_CONSTRAINT)) return false;
  return (
    message.includes(BOOKING_OVERLAP_CONSTRAINT) || message.includes("23P01")
  );
}

/** True when the client-hour exclusion constraint rejected the insert (BR-008). */
export function isClientBookingConflictError(error: unknown): boolean {
  const message = errorMessage(error);
  return Boolean(
    message && message.includes(BOOKING_CLIENT_OVERLAP_CONSTRAINT),
  );
}
