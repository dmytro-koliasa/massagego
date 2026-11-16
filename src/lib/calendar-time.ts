import { DateTime } from "luxon";
import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  SLOT_MS,
} from "@/lib/booking-constants";
import { alignToHour, timeZoneLabel } from "@/lib/masseur-time";

/** Align an instant to the hour in `zone` and return a UTC ISO string. */
export function alignToHourIso(date: Date, zone: string): string {
  return alignToHour(date, zone).toISOString();
}

function localeTag(locale: "en" | "uk") {
  return locale === "uk" ? "uk-UA" : "en-GB";
}

function getMonthName(date: Date, locale: "en" | "uk", zone: string) {
  const tag = localeTag(locale);
  if (locale === "uk") {
    return (
      new Intl.DateTimeFormat(tag, {
        timeZone: zone,
        day: "numeric",
        month: "long",
      })
        .formatToParts(date)
        .find((part) => part.type === "month")?.value ?? ""
    );
  }
  return new Intl.DateTimeFormat(tag, {
    timeZone: zone,
    month: "long",
  }).format(date);
}

function zonedParts(date: Date, locale: "en" | "uk", zone: string) {
  const parts = new Intl.DateTimeFormat(localeTag(locale), {
    timeZone: zone,
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    day: Number(get("day")),
    month: Number(get("month")),
    year: Number(get("year")),
  };
}

/** Week title for `[from, to)` using calendar dates in `zone`. */
export function formatWeekTitle(
  fromIso: string,
  toIso: string,
  locale: "en" | "uk",
  zone: string,
) {
  const start = new Date(fromIso);
  const end = new Date(new Date(toIso).getTime() - 1);
  const startParts = zonedParts(start, locale, zone);
  const endParts = zonedParts(end, locale, zone);

  if (
    startParts.year === endParts.year &&
    startParts.month === endParts.month
  ) {
    const month = getMonthName(start, locale, zone);
    return `${startParts.day} – ${endParts.day} ${month} ${startParts.year}`;
  }

  const startMonth = getMonthName(start, locale, zone);
  const endMonth = getMonthName(end, locale, zone);

  if (startParts.year === endParts.year) {
    return `${startParts.day} ${startMonth} – ${endParts.day} ${endMonth} ${startParts.year}`;
  }

  return `${startParts.day} ${startMonth} ${startParts.year} – ${endParts.day} ${endMonth} ${endParts.year}`;
}

export function formatHourRange(
  start: Date,
  end: Date,
  locale: "en" | "uk",
  zone: string,
) {
  const formatter = new Intl.DateTimeFormat(localeTag(locale), {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return {
    start: formatter.format(start),
    end: formatter.format(end),
  };
}

/** Human-readable slot for lists and cancel dialogs, in `zone`. */
export function formatSlotDateTime(
  startIso: string,
  locale: "en" | "uk",
  zone: string,
) {
  const start = new Date(startIso);
  const end = new Date(start.getTime() + SLOT_MS);
  const datePart = new Intl.DateTimeFormat(localeTag(locale), {
    timeZone: zone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(start);
  const hours = formatHourRange(start, end, locale, zone);
  return `${datePart}, ${hours.start}-${hours.end}`;
}

/**
 * Every hour in `[from, to)` that lies inside the working window in `zone`.
 * Optional `fromNow` skips hours that have already started in that zone.
 */
export function getWeekSlotStarts(
  fromIso: string,
  toIso: string,
  zone: string,
  options?: { fromNow?: boolean },
) {
  const starts: string[] = [];
  let cursor = DateTime.fromISO(fromIso, { zone: "utc" })
    .setZone(zone)
    .startOf("hour");
  const endMs = DateTime.fromISO(toIso, { zone: "utc" }).toMillis();

  let minMs = Number.NEGATIVE_INFINITY;
  if (options?.fromNow) {
    minMs = DateTime.now().setZone(zone).startOf("hour").toMillis();
  }

  while (cursor.toMillis() < endMs) {
    if (
      cursor.hour >= DAY_START_HOUR &&
      cursor.hour < DAY_END_HOUR &&
      cursor.toMillis() >= minMs
    ) {
      starts.push(cursor.toUTC().toISO()!);
    }
    cursor = cursor.plus({ hours: 1 });
  }

  return starts;
}

/** Fill `Times in {label}` / `Час: {label}` with the zone label at `instant`. */
export function formatCalendarTimeZoneLine(
  template: string,
  zone: string,
  instant: Date = new Date(),
) {
  return template.replaceAll("{label}", timeZoneLabel(zone, instant));
}
