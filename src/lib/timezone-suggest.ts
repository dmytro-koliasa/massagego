import { find } from "geo-tz";
import { DateTime, IANAZone } from "luxon";
import { DEFAULT_MASSEUR_TIME_ZONE } from "@/lib/booking-constants";

export function isValidIanaTimeZone(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return IANAZone.isValidZone(trimmed);
}

export function suggestTimezone(
  lat: number | null | undefined,
  lon: number | null | undefined,
): string {
  if (
    typeof lat !== "number" ||
    typeof lon !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon)
  ) {
    return DEFAULT_MASSEUR_TIME_ZONE;
  }

  try {
    const zones = find(lat, lon);
    const first = zones.find((zone) => isValidIanaTimeZone(zone));
    return first ?? DEFAULT_MASSEUR_TIME_ZONE;
  } catch {
    return DEFAULT_MASSEUR_TIME_ZONE;
  }
}

export function normalizeTimeZone(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (isValidIanaTimeZone(trimmed)) return trimmed;
  return DEFAULT_MASSEUR_TIME_ZONE;
}

export function deviceTimeZone(): string {
  try {
    return (
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      DEFAULT_MASSEUR_TIME_ZONE
    );
  } catch {
    return DEFAULT_MASSEUR_TIME_ZONE;
  }
}

export function formatTimeZoneOffsetLabel(
  timeZone: string,
  at: Date = new Date(),
): string {
  const zone = normalizeTimeZone(timeZone);
  const offset = DateTime.fromJSDate(at, { zone }).toFormat("ZZ");
  const city = zone.split("/").pop()?.replaceAll("_", " ") ?? zone;
  return `${city}, UTC${offset}`;
}
