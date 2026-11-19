import { isExcludedCountryCode } from "@/lib/phone-countries";
import { suggestTimezone } from "@/lib/timezone-suggest";

export const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";

/** Identifying UA for OSMF Nominatim (#113). No legacy SereinMassageApp. */
export const GEOCODE_USER_AGENT =
  "MassageGo/1.0 (city-lookup; https://github.com/dmytro-koliasa/massagego)";

export const NOMINATIM_FETCH_LIMIT = 20;
export const GEOCODE_RESULT_LIMIT = 6;

export type NominatimCityResult = {
  place_id: number;
  name?: string;
  display_name: string;
  lat?: string;
  lon?: string;
  address?: {
    country_code?: string;
  };
};

export type GeocodeCitySuggestion = {
  id: string;
  placeId: string;
  countryCode: string;
  label: string;
  detail: string;
  nameEn: string;
  nameUk: string;
  lat: number | null;
  lon: number | null;
  timeZone: string | null;
};

export function shortCityLabel(item: NominatimCityResult): string {
  const name = item.name?.trim();
  if (name) return name;
  return item.display_name.split(",")[0]?.trim() || item.display_name;
}

export function mapNominatimCityResults(
  data: NominatimCityResult[],
  lang: "en" | "uk",
  resultLimit = GEOCODE_RESULT_LIMIT,
): GeocodeCitySuggestion[] {
  return data
    .filter((item) => !isExcludedCountryCode(item.address?.country_code))
    .slice(0, resultLimit)
    .map((item) => {
      const label = shortCityLabel(item);
      const lat = item.lat ? Number(item.lat) : null;
      const lon = item.lon ? Number(item.lon) : null;
      const countryCode = (item.address?.country_code ?? "").toUpperCase();
      const safeLat = Number.isFinite(lat) ? lat : null;
      const safeLon = Number.isFinite(lon) ? lon : null;
      return {
        id: String(item.place_id),
        placeId: String(item.place_id),
        countryCode,
        label,
        detail: item.display_name,
        nameEn: label,
        nameUk: label,
        lat: safeLat,
        lon: safeLon,
        timeZone: suggestTimezone(safeLat, safeLon),
      };
    })
    .filter((item) => item.countryCode.length === 2);
}

export function buildNominatimCitySearchUrl(q: string): URL {
  const url = new URL(NOMINATIM_SEARCH_URL);
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("featureType", "settlement");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", String(NOMINATIM_FETCH_LIMIT));
  return url;
}

export async function fetchNominatimCityResults(
  q: string,
  lang: "en" | "uk",
  fetchImpl: typeof fetch = fetch,
): Promise<GeocodeCitySuggestion[]> {
  const url = buildNominatimCitySearchUrl(q);
  const response = await fetchImpl(url, {
    headers: {
      "User-Agent": GEOCODE_USER_AGENT,
      Accept: "application/json",
      "Accept-Language": lang === "en" ? "en" : "uk,ru;q=0.8,en;q=0.5",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`nominatim_http_${response.status}`);
  }

  const data = (await response.json()) as NominatimCityResult[];
  return mapNominatimCityResults(data, lang);
}
