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

/** Max rows on the masseur dashboard recent-cancellations list. */
export const RECENT_CANCELLATIONS_LIMIT = 20;

export type RecentCancellationRow = {
  id: string;
  slotStart: Date | null;
  cancelledAt: Date | null;
  clientName: string;
  cancelReason: string | null;
  cancelReasonText: string | null;
};

export type RecentCancellationDto = {
  id: string;
  slotStart: string;
  cancelledAt: string;
  clientName: string;
  reason: string;
  reasonText: string | null;
};

/** Map DB rows already filtered to client cancels in the retention window. */
export function mapRecentCancellations(
  rows: RecentCancellationRow[],
  limit = RECENT_CANCELLATIONS_LIMIT,
): RecentCancellationDto[] {
  const out: RecentCancellationDto[] = [];
  for (const row of rows) {
    if (!row.slotStart || !row.cancelledAt || !row.cancelReason) continue;
    out.push({
      id: row.id,
      slotStart: row.slotStart.toISOString(),
      cancelledAt: row.cancelledAt.toISOString(),
      clientName: row.clientName,
      reason: row.cancelReason,
      reasonText: row.cancelReasonText,
    });
    if (out.length >= limit) break;
  }
  return out;
}
