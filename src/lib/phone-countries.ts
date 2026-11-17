import { getCountries, type CountryCode } from "libphonenumber-js";

/**
 * Shared excluded-country blocklist for phone validation and city search (BR-013).
 * Africa = UN M49 region 002 (including dependent territories); plus RU and BY.
 * Kazakhstan (KZ) is intentionally not listed — +7 is resolved via libphonenumber.
 */
export const EXCLUDED_COUNTRY_CODES = [
  // Northern Africa
  "DZ",
  "EG",
  "LY",
  "MA",
  "SD",
  "TN",
  "EH",
  // Eastern Africa
  "IO",
  "BI",
  "KM",
  "DJ",
  "ER",
  "ET",
  "TF",
  "KE",
  "MG",
  "MW",
  "MU",
  "YT",
  "MZ",
  "RE",
  "RW",
  "SC",
  "SO",
  "SS",
  "UG",
  "TZ",
  "ZM",
  "ZW",
  // Middle Africa
  "AO",
  "CM",
  "CF",
  "TD",
  "CG",
  "CD",
  "GQ",
  "GA",
  "ST",
  // Southern Africa
  "BW",
  "SZ",
  "LS",
  "NA",
  "ZA",
  // Western Africa
  "BJ",
  "BF",
  "CV",
  "CI",
  "GM",
  "GH",
  "GN",
  "GW",
  "LR",
  "ML",
  "MR",
  "NE",
  "NG",
  "SH",
  "SN",
  "SL",
  "TG",
  // Explicit extras
  "RU",
  "BY",
] as const;

export type ExcludedCountryCode = (typeof EXCLUDED_COUNTRY_CODES)[number];

const EXCLUDED_SET = new Set<string>(EXCLUDED_COUNTRY_CODES);

export function isExcludedCountryCode(
  code: string | null | undefined,
): boolean {
  if (!code) return false;
  return EXCLUDED_SET.has(code.trim().toUpperCase());
}

/** Countries offered in the phone picker (Ukraine remains the default in UI). */
export const PHONE_COUNTRIES_ALLOWED: CountryCode[] = getCountries().filter(
  (code) => !isExcludedCountryCode(code),
);
