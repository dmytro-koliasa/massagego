import { NextResponse } from "next/server";
import { isExcludedCountryCode } from "@/lib/phone-countries";
import { suggestTimezone } from "@/lib/timezone-suggest";
import { CITY_MAX, CITY_QUERY_MIN } from "@/lib/validation";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "SereinMassageApp/1.0 (city-lookup; local-dev)";
const FETCH_LIMIT = 20;
const RESULT_LIMIT = 6;

type NominatimResult = {
  place_id: number;
  name?: string;
  display_name: string;
  lat?: string;
  lon?: string;
  address?: {
    country_code?: string;
  };
};

function shortLabel(item: NominatimResult) {
  const name = item.name?.trim();
  if (name) return name;
  return item.display_name.split(",")[0]?.trim() || item.display_name;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const lang = searchParams.get("lang") === "en" ? "en" : "uk";

  if (q.length < CITY_QUERY_MIN || q.length > CITY_MAX) {
    return NextResponse.json({ results: [] });
  }

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("featureType", "settlement");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", String(FETCH_LIMIT));

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        "Accept-Language": lang === "en" ? "en" : "uk,ru;q=0.8,en;q=0.5",
      },
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return NextResponse.json({ results: [] }, { status: 502 });
    }

    const data = (await response.json()) as NominatimResult[];
    const results = data
      .filter((item) => !isExcludedCountryCode(item.address?.country_code))
      .slice(0, RESULT_LIMIT)
      .map((item) => {
        const label = shortLabel(item);
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
          nameEn: lang === "en" ? label : label,
          nameUk: lang === "uk" ? label : label,
          lat: safeLat,
          lon: safeLon,
          timeZone: suggestTimezone(safeLat, safeLon),
        };
      })
      .filter((item) => item.countryCode.length === 2);

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] }, { status: 502 });
  }
}
