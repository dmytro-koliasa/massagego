import { DateTime, IANAZone } from "luxon";
import {
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

/**
 * Adds whole weeks keeping the local clock time, so a 10:00 slot stays 10:00
 * across a daylight-saving change.
 */
export function addLocalWeeks(instant: Date, weeks: number, zone: string): Date {
  return inZone(instant, zone).plus({ weeks }).toJSDate();
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
