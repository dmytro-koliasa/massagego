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

/** Weekly copy of availability ("copy week forward"). */
export const WEEKLY_COPY_DEFAULT_WEEKS = 12;
export const WEEKLY_COPY_MAX_WEEKS = 52;

/** Active (confirmed, not yet started) bookings one client may hold (BR-008). */
export const MAX_ACTIVE_FUTURE_BOOKINGS_PER_CLIENT = 30;

/** Retention of bookings without obligations (BR-011, BR-018). */
export const CANCELLED_BOOKING_RETENTION_DAYS = 7;
export const COMPLETED_BOOKING_RETENTION_MONTHS = 3;
