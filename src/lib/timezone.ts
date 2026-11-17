import { DateTime, IANAZone } from "luxon";
import { DEFAULT_MASSEUR_TIME_ZONE } from "@/lib/booking-constants";

/** Browser-safe IANA helpers (no Node fs / geo-tz). */

export function isValidIanaTimeZone(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return IANAZone.isValidZone(trimmed);
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
