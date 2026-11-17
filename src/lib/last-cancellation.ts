import { cancelledBookingEligibleBefore } from "@/lib/booking-cleanup-rules";

export type LastCancellation = {
  reason: string;
  reasonText: string | null;
  cancelledAt: string;
};

export type LastCancellationRow = {
  slotStart: Date | null;
  cancelReason: string | null;
  cancelReasonText: string | null;
  cancelledAt: Date | null;
};

/**
 * Latest client cancellation per slotStart (ISO), for rows already filtered to
 * client cancels inside the retention window.
 */
export function pickLastCancellationsBySlotStart(
  rows: LastCancellationRow[],
): Map<string, LastCancellation> {
  const map = new Map<string, LastCancellation>();
  for (const row of rows) {
    if (!row.slotStart || !row.cancelledAt || !row.cancelReason) continue;
    const key = row.slotStart.toISOString();
    const prev = map.get(key);
    if (
      prev &&
      Date.parse(prev.cancelledAt) >= row.cancelledAt.getTime()
    ) {
      continue;
    }
    map.set(key, {
      reason: row.cancelReason,
      reasonText: row.cancelReasonText,
      cancelledAt: row.cancelledAt.toISOString(),
    });
  }
  return map;
}

/** Client cancellations older than this are outside the 7-day retention window. */
export function lastCancellationSince(now = new Date()): Date {
  return cancelledBookingEligibleBefore(now);
}
