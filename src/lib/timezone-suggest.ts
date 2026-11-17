import "server-only";
import { find } from "geo-tz";
import { DEFAULT_MASSEUR_TIME_ZONE } from "@/lib/booking-constants";
import { isValidIanaTimeZone } from "@/lib/timezone";

/** Server-only helper (geo-tz uses Node fs). Do not import from client components. */

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
