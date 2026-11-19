/**
 * Shared from/to query validation for list/calendar APIs (#114).
 */

/** Client sessions list: H4 — required bounds, max one year. */
export const CLIENT_BOOKINGS_LIST_MAX_SPAN_MS = 366 * 24 * 60 * 60 * 1000;

/**
 * FullCalendar timeGridWeek visible ranges are ~7 days (plus TZ padding).
 * 45 days leaves headroom without allowing multi-month DB scans.
 */
export const CALENDAR_AVAILABILITY_MAX_SPAN_MS = 45 * 24 * 60 * 60 * 1000;

export type DateRangeError = "invalid_range" | "range_too_large";

export type DateRangeParseResult =
  | { ok: true; from: Date; to: Date }
  | { ok: false; error: DateRangeError };

/**
 * Require both ends, valid instants, from < to, and span ≤ maxSpanMs.
 * Pagination for large result sets is deferred: week UIs request small windows;
 * even a full 366d client booking list is bounded by account activity (#114).
 */
export function parseRequiredDateRange(
  fromRaw: string | null | undefined,
  toRaw: string | null | undefined,
  maxSpanMs: number,
): DateRangeParseResult {
  if (fromRaw == null || toRaw == null || fromRaw === "" || toRaw === "") {
    return { ok: false, error: "invalid_range" };
  }

  const from = new Date(fromRaw);
  const to = new Date(toRaw);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { ok: false, error: "invalid_range" };
  }

  if (from.getTime() >= to.getTime()) {
    return { ok: false, error: "invalid_range" };
  }

  if (to.getTime() - from.getTime() > maxSpanMs) {
    return { ok: false, error: "range_too_large" };
  }

  return { ok: true, from, to };
}
