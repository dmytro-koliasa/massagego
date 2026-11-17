import type { Locale } from "@/lib/i18n";

export type CanonicalCity = {
  placeId: string;
  countryCode: string;
  nameEn: string;
  nameUk: string;
  lat?: number | null;
  lon?: number | null;
};

export type CityFields = {
  city?: string | null;
  cityPlaceId?: string | null;
  cityCountryCode?: string | null;
  cityNameEn?: string | null;
  cityNameUk?: string | null;
  cityLat?: number | null;
  cityLon?: number | null;
};

export function isCanonicalCity(
  value: Partial<CanonicalCity> | null | undefined,
): value is CanonicalCity {
  return Boolean(
    value &&
      value.placeId?.trim() &&
      value.countryCode?.trim() &&
      value.nameEn?.trim() &&
      value.nameUk?.trim(),
  );
}

export function cityDisplayName(
  fields: CityFields,
  locale: Locale,
): string {
  const localized =
    locale === "uk"
      ? fields.cityNameUk?.trim() || fields.cityNameEn?.trim()
      : fields.cityNameEn?.trim() || fields.cityNameUk?.trim();
  return localized || fields.city?.trim() || "";
}

/** Stable filter / compare key: place id when present, else legacy label. */
export function cityFilterKey(fields: CityFields): string {
  const placeId = fields.cityPlaceId?.trim();
  if (placeId) return `id:${placeId}`;
  const legacy = fields.city?.trim();
  return legacy ? `name:${legacy}` : "";
}

export function toCityWriteData(
  city: CanonicalCity,
  locale: Locale,
): {
  city: string;
  cityPlaceId: string;
  cityCountryCode: string;
  cityNameEn: string;
  cityNameUk: string;
  cityLat: number | null;
  cityLon: number | null;
} {
  const nameEn = city.nameEn.trim();
  const nameUk = city.nameUk.trim();
  return {
    city: locale === "uk" ? nameUk || nameEn : nameEn || nameUk,
    cityPlaceId: city.placeId.trim(),
    cityCountryCode: city.countryCode.trim().toUpperCase(),
    cityNameEn: nameEn,
    cityNameUk: nameUk,
    cityLat:
      typeof city.lat === "number" && Number.isFinite(city.lat) ? city.lat : null,
    cityLon:
      typeof city.lon === "number" && Number.isFinite(city.lon) ? city.lon : null,
  };
}

export function hasCanonicalCity(fields: CityFields): boolean {
  return Boolean(fields.cityPlaceId?.trim());
}
