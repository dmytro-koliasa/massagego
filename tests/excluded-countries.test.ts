import { describe, expect, it } from "vitest";
import {
  EXCLUDED_COUNTRY_CODES,
  isExcludedCountryCode,
  PHONE_COUNTRIES_ALLOWED,
} from "@/lib/phone-countries";
import {
  checkBookingPhone,
  phoneSchema,
  zodErrorCode,
} from "@/lib/validation/common";

describe("excluded country blocklist", () => {
  it("includes UN M49 Africa samples plus RU and BY, not KZ", () => {
    expect(isExcludedCountryCode("EG")).toBe(true);
    expect(isExcludedCountryCode("za")).toBe(true);
    expect(isExcludedCountryCode("RE")).toBe(true);
    expect(isExcludedCountryCode("YT")).toBe(true);
    expect(isExcludedCountryCode("RU")).toBe(true);
    expect(isExcludedCountryCode("BY")).toBe(true);
    expect(isExcludedCountryCode("KZ")).toBe(false);
    expect(isExcludedCountryCode("UA")).toBe(false);
    expect(isExcludedCountryCode("US")).toBe(false);
    expect(EXCLUDED_COUNTRY_CODES).toContain("TF");
  });

  it("omits excluded codes from the phone picker list", () => {
    expect(PHONE_COUNTRIES_ALLOWED).toContain("UA");
    expect(PHONE_COUNTRIES_ALLOWED).toContain("KZ");
    expect(PHONE_COUNTRIES_ALLOWED).not.toContain("RU");
    expect(PHONE_COUNTRIES_ALLOWED).not.toContain("BY");
    expect(PHONE_COUNTRIES_ALLOWED).not.toContain("EG");
    expect(PHONE_COUNTRIES_ALLOWED).not.toContain("NG");
  });
});

describe("checkBookingPhone", () => {
  it("accepts Ukraine and Kazakhstan", () => {
    expect(checkBookingPhone("+380501234567")).toEqual({ ok: true });
    expect(checkBookingPhone("+77001234567")).toEqual({ ok: true });
  });

  it("rejects Russia, Belarus and African numbers", () => {
    expect(checkBookingPhone("+79001234567")).toEqual({
      ok: false,
      error: "phone_country_excluded",
    });
    expect(checkBookingPhone("+375291234567")).toEqual({
      ok: false,
      error: "phone_country_excluded",
    });
    expect(checkBookingPhone("+201012345678")).toEqual({
      ok: false,
      error: "phone_country_excluded",
    });
    expect(checkBookingPhone("+2348012345678")).toEqual({
      ok: false,
      error: "phone_country_excluded",
    });
  });

  it("rejects malformed numbers as invalid_phone", () => {
    expect(checkBookingPhone("not-a-phone")).toEqual({
      ok: false,
      error: "invalid_phone",
    });
  });
});

describe("phoneSchema error codes", () => {
  it("maps excluded country to phone_country_excluded", () => {
    const result = phoneSchema.safeParse("+79001234567");
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(zodErrorCode(result.error)).toBe("phone_country_excluded");
  });

  it("formats an allowed number to E.164", () => {
    const result = phoneSchema.safeParse("+380 50 123 4567");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toBe("+380501234567");
  });
});
