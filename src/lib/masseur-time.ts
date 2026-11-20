import { DateTime, IANAZone } from "luxon";
import {
  CLIENT_BOOKING_WINDOW_DAYS,
  DAY_END_HOUR,
  DAY_START_HOUR,
  DEFAULT_MASSEUR_TIME_ZONE,
} from "@/lib/booking-constants";

/**
 * Time helpers evaluated in a masseur's IANA time zone (BR-006). They never
 * depend on the server's or the viewer's local time zone.
 */

export function isValidTimeZone(zone: unknown): zone is string {
  return typeof zone === "string" && zone.length > 0 && IANAZone.isValidZone(zone);
}

export function resolveTimeZone(zone: string | null | undefined): string {
  return isValidTimeZone(zone) ? zone : DEFAULT_MASSEUR_TIME_ZONE;
}

function inZone(instant: Date, zone: string) {
  return DateTime.fromJSDate(instant, { zone });
}

/** Start of the local hour that contains `instant`. */
export function alignToHour(instant: Date, zone: string): Date {
  return inZone(instant, zone).startOf("hour").toJSDate();
}

/** Start of the local calendar day ("today" for `now`). */
export function startOfLocalDay(instant: Date, zone: string): Date {
  return inZone(instant, zone).startOf("day").toJSDate();
}

/** True when a slot starting at `start` lies inside the 05:00-23:00 window. */
export function isWithinWorkingHours(start: Date, zone: string): boolean {
  const hour = inZone(start, zone).hour;
  return hour >= DAY_START_HOUR && hour < DAY_END_HOUR;
}

/** True once the slot's start instant has been reached. */
export function isSlotStarted(start: Date, now: Date = new Date()): boolean {
  return start.getTime() <= now.getTime();
}

/**
 * Exclusive end of the client booking window: start of the local day after
 * `today + CLIENT_BOOKING_WINDOW_DAYS` in the masseur's zone (BR-003).
 */
export function clientBookingWindowExclusiveEnd(
  now: Date,
  zone: string,
): Date {
  return inZone(now, zone)
    .startOf("day")
    .plus({ days: CLIENT_BOOKING_WINDOW_DAYS + 1 })
    .toJSDate();
}

/** Last local calendar day a client may still book (inclusive). */
export function clientBookingWindowLastDay(now: Date, zone: string): Date {
  return inZone(now, zone)
    .startOf("day")
    .plus({ days: CLIENT_BOOKING_WINDOW_DAYS })
    .toJSDate();
}

/** True when the slot's start falls on or before the last bookable local day. */
export function isWithinClientBookingWindow(
  slotStart: Date,
  zone: string,
  now: Date = new Date(),
): boolean {
  return slotStart.getTime() < clientBookingWindowExclusiveEnd(now, zone).getTime();
}

/**
 * True while `now < slotStart - leadHours` (strict boundary, BR-002).
 * At exactly `slotStart - leadHours` the slot is already hidden.
 */
export function isOutsideClientLeadTime(
  slotStart: Date,
  leadHours: number,
  now: Date = new Date(),
): boolean {
  const leadMs = leadHours * 60 * 60 * 1000;
  return now.getTime() + leadMs < slotStart.getTime();
}

/** Client may see and book the slot (lead time + 120-day window). */
export function isClientBookableSlot(
  slotStart: Date,
  zone: string,
  leadHours: number,
  now: Date = new Date(),
): boolean {
  return (
    isOutsideClientLeadTime(slotStart, leadHours, now) &&
    isWithinClientBookingWindow(slotStart, zone, now)
  );
}

/**
 * Adds whole weeks keeping the local clock time, so a 10:00 slot stays 10:00
 * across a daylight-saving change.
 */
export function addLocalWeeks(instant: Date, weeks: number, zone: string): Date {
  return inZone(instant, zone).plus({ weeks }).toJSDate();
}

/**
 * Monday 00:00 → next Monday 00:00 in `zone` that contains `now`
 * (matches FullCalendar `firstDay={1}` week bounds used by weekly copy).
 */
export function currentLocalWeekRange(
  now: Date,
  zone: string,
): { from: Date; to: Date } {
  const from = inZone(now, zone).startOf("week");
  return {
    from: from.toJSDate(),
    to: from.plus({ weeks: 1 }).toJSDate(),
  };
}

/** True when `from`/`to` are exactly the current local week bounds. */
export function isCurrentLocalWeekRange(
  from: Date,
  to: Date,
  zone: string,
  now: Date = new Date(),
): boolean {
  const week = currentLocalWeekRange(now, zone);
  return (
    from.getTime() === week.from.getTime() && to.getTime() === week.to.getTime()
  );
}

function formatOffset(offsetMinutes: number) {
  const sign = offsetMinutes < 0 ? "-" : "+";
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return `UTC${sign}${hours}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""}`;
}

/** "Kyiv, UTC+2": the zone's city and its offset at `instant`. */
export function timeZoneLabel(zone: string, instant: Date): string {
  const city = zone.split("/").pop()?.replaceAll("_", " ") || zone;
  return `${city}, ${formatOffset(inZone(instant, zone).offset)}`;
}

/** Date and time in the masseur's zone followed by the zone label. */
export function formatInMasseurTimeZone(
  instant: Date,
  zone: string,
  locale: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
): string {
  const formatted = new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: zone,
  }).format(instant);
  return `${formatted} (${timeZoneLabel(zone, instant)})`;
}
