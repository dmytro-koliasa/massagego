import { describe, expect, it } from "vitest";
import {
  cityDisplayName,
  cityFilterKey,
  isCanonicalCity,
  toCityWriteData,
} from "@/lib/city";
import {
  isValidIanaTimeZone,
  normalizeTimeZone,
  suggestTimezone,
} from "@/lib/timezone-suggest";

describe("canonical city helpers", () => {
  const kyivInput = {
    placeId: "123",
    countryCode: "UA",
    nameEn: "Kyiv",
    nameUk: "Київ",
    lat: 50.45,
    lon: 30.52,
  };
  const kyivStored = {
    city: "Київ",
    cityPlaceId: "123",
    cityCountryCode: "UA",
    cityNameEn: "Kyiv",
    cityNameUk: "Київ",
    cityLat: 50.45,
    cityLon: 30.52,
  };

  it("accepts a full canonical city", () => {
    expect(isCanonicalCity(kyivInput)).toBe(true);
    expect(isCanonicalCity({ ...kyivInput, placeId: "" })).toBe(false);
  });

  it("prefers locale-specific display names", () => {
    expect(cityDisplayName(kyivStored, "en")).toBe("Kyiv");
    expect(cityDisplayName(kyivStored, "uk")).toBe("Київ");
    expect(
      cityDisplayName({ city: "Legacy", cityPlaceId: null }, "en"),
    ).toBe("Legacy");
  });

  it("builds stable filter keys and write payloads", () => {
    expect(cityFilterKey(kyivStored)).toBe("id:123");
    expect(cityFilterKey({ city: "Kyiv" })).toBe("name:Kyiv");
    expect(toCityWriteData(kyivInput, "uk")).toMatchObject({
      city: "Київ",
      cityPlaceId: "123",
      cityCountryCode: "UA",
      cityNameEn: "Kyiv",
      cityNameUk: "Київ",
    });
  });
});

describe("timezone suggest", () => {
  it("validates IANA zones", () => {
    expect(isValidIanaTimeZone("Europe/Kyiv")).toBe(true);
    expect(isValidIanaTimeZone("Not/AZone")).toBe(false);
    expect(normalizeTimeZone("garbage")).toBe("Europe/Kyiv");
  });

  it("suggests a zone near Kyiv", () => {
    const zone = suggestTimezone(50.45, 30.52);
    expect(zone).toMatch(/^Europe\//);
  });
});
