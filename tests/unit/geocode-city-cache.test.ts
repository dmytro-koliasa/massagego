import { describe, expect, it } from "vitest";
import {
  cityGeocodeCacheKey,
  createCityGeocodeCache,
  normalizeCityQuery,
} from "@/lib/geocode/city-cache";
import {
  GEOCODE_USER_AGENT,
  mapNominatimCityResults,
  type NominatimCityResult,
} from "@/lib/geocode/nominatim-city";

describe("city geocode cache (#113)", () => {
  it("normalizes query keys", () => {
    expect(normalizeCityQuery("  Kyiv   City ")).toBe("kyiv city");
    expect(cityGeocodeCacheKey("Kyiv", "uk")).toBe("uk:kyiv");
  });

  it("returns cached values until TTL expires", () => {
    const cache = createCityGeocodeCache<string[]>({ ttlMs: 1_000 });
    const key = cityGeocodeCacheKey("Lviv", "en");
    const t0 = 1_000_000;
    cache.set(key, ["a"], t0);
    expect(cache.get(key, t0 + 500)).toEqual(["a"]);
    expect(cache.get(key, t0 + 1_001)).toBeUndefined();
  });
});

describe("nominatim city mapping (#113)", () => {
  it("uses MassageGo User-Agent (not SereinMassageApp)", () => {
    expect(GEOCODE_USER_AGENT).toContain("MassageGo/");
    expect(GEOCODE_USER_AGENT.toLowerCase()).not.toContain("serein");
  });

  it("filters excluded countries and maps labels", () => {
    const raw: NominatimCityResult[] = [
      {
        place_id: 1,
        name: "Kyiv",
        display_name: "Kyiv, Ukraine",
        lat: "50.45",
        lon: "30.52",
        address: { country_code: "ua" },
      },
      {
        place_id: 2,
        name: "Minsk",
        display_name: "Minsk, Belarus",
        lat: "53.9",
        lon: "27.5",
        address: { country_code: "by" },
      },
    ];
    const mapped = mapNominatimCityResults(raw, "en");
    expect(mapped).toHaveLength(1);
    expect(mapped[0]?.placeId).toBe("1");
    expect(mapped[0]?.countryCode).toBe("UA");
    expect(mapped[0]?.label).toBe("Kyiv");
  });
});
