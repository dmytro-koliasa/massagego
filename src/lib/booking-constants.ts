/** Every session is exactly one hour (BR-001). */
export const SESSION_MINUTES = 60;
export const SLOT_MS = SESSION_MINUTES * 60 * 1000;

/**
 * Global working window in the masseur's time zone (BR-007): the first slot
 * starts at 05:00, the last one at 22:00.
 */
export const DAY_START_HOUR = 5;
export const DAY_END_HOUR = 23;

function calendarTime(totalMinutes: number) {
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${hours}:${minutes}:00`;
}

/** FullCalendar duration strings derived from the values above. */
export const CALENDAR_SLOT_DURATION = calendarTime(SESSION_MINUTES);
export const CALENDAR_SLOT_MIN_TIME = calendarTime(DAY_START_HOUR * 60);
export const CALENDAR_SLOT_MAX_TIME = calendarTime(DAY_END_HOUR * 60);

export const DEFAULT_MASSEUR_TIME_ZONE = "Europe/Kyiv";

/** Clients can see and book slots up to this many days ahead (BR-003). */
export const CLIENT_BOOKING_WINDOW_DAYS = 120;

/** Weekly copy of availability ("copy week forward"); max ≈ 120/7 (BR-003). */
export const WEEKLY_COPY_DEFAULT_WEEKS = 12;
export const WEEKLY_COPY_MAX_WEEKS = 17;

/** Per-masseur client booking lead time in hours (BR-002). */
export const BOOKING_LEAD_HOURS_OPTIONS = [1, 2, 3, 4] as const;
export type BookingLeadHours = (typeof BOOKING_LEAD_HOURS_OPTIONS)[number];
export const DEFAULT_BOOKING_LEAD_HOURS: BookingLeadHours = 1;

/** Per-masseur client cancellation cutoff in hours (BR-004); never below lead. */
export const CANCEL_CUTOFF_HOURS_OPTIONS = [
  1, 2, 3, 4, 6, 8, 12, 24, 36, 48, 72,
] as const;
export type CancelCutoffHours = (typeof CANCEL_CUTOFF_HOURS_OPTIONS)[number];
export const DEFAULT_CANCEL_CUTOFF_HOURS: CancelCutoffHours = 24;

export function isBookingLeadHours(value: unknown): value is BookingLeadHours {
  return (
    typeof value === "number" &&
    (BOOKING_LEAD_HOURS_OPTIONS as readonly number[]).includes(value)
  );
}

export function isCancelCutoffHours(
  value: unknown,
): value is CancelCutoffHours {
  return (
    typeof value === "number" &&
    (CANCEL_CUTOFF_HOURS_OPTIONS as readonly number[]).includes(value)
  );
}

/** Active (confirmed, not yet started) bookings one client may hold (BR-008). */
export const MAX_ACTIVE_FUTURE_BOOKINGS_PER_CLIENT = 30;

/** Retention of bookings without obligations (BR-011, BR-018). */
export const CANCELLED_BOOKING_RETENTION_DAYS = 7;
export const COMPLETED_BOOKING_RETENTION_MONTHS = 3;
