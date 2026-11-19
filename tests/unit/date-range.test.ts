import { describe, expect, it } from "vitest";
import {
  CALENDAR_AVAILABILITY_MAX_SPAN_MS,
  CLIENT_BOOKINGS_LIST_MAX_SPAN_MS,
  parseRequiredDateRange,
} from "@/lib/date-range";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("parseRequiredDateRange (#114)", () => {
  it("requires both ends", () => {
    expect(parseRequiredDateRange(null, "2026-01-02T00:00:00.000Z", DAY_MS)).toEqual({
      ok: false,
      error: "invalid_range",
    });
    expect(parseRequiredDateRange("2026-01-01T00:00:00.000Z", "", DAY_MS)).toEqual({
      ok: false,
      error: "invalid_range",
    });
  });

  it("rejects invalid and reverse ranges", () => {
    expect(
      parseRequiredDateRange("not-a-date", "2026-01-02T00:00:00.000Z", DAY_MS),
    ).toEqual({ ok: false, error: "invalid_range" });
    expect(
      parseRequiredDateRange(
        "2026-01-02T00:00:00.000Z",
        "2026-01-01T00:00:00.000Z",
        DAY_MS,
      ),
    ).toEqual({ ok: false, error: "invalid_range" });
    expect(
      parseRequiredDateRange(
        "2026-01-01T00:00:00.000Z",
        "2026-01-01T00:00:00.000Z",
        DAY_MS,
      ),
    ).toEqual({ ok: false, error: "invalid_range" });
  });

  it("rejects spans over the max", () => {
    const from = "2026-01-01T00:00:00.000Z";
    const to = new Date(Date.parse(from) + CLIENT_BOOKINGS_LIST_MAX_SPAN_MS + 1).toISOString();
    expect(
      parseRequiredDateRange(from, to, CLIENT_BOOKINGS_LIST_MAX_SPAN_MS),
    ).toEqual({ ok: false, error: "range_too_large" });
  });

  it("accepts a week-sized calendar range", () => {
    const from = "2026-06-01T00:00:00.000Z";
    const to = "2026-06-08T00:00:00.000Z";
    const result = parseRequiredDateRange(
      from,
      to,
      CALENDAR_AVAILABILITY_MAX_SPAN_MS,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.from.toISOString()).toBe(from);
      expect(result.to.toISOString()).toBe(to);
    }
  });

  it("accepts a 366-day bookings span inclusive of the limit", () => {
    const from = "2025-01-01T00:00:00.000Z";
    const to = new Date(
      Date.parse(from) + CLIENT_BOOKINGS_LIST_MAX_SPAN_MS,
    ).toISOString();
    const result = parseRequiredDateRange(
      from,
      to,
      CLIENT_BOOKINGS_LIST_MAX_SPAN_MS,
    );
    expect(result.ok).toBe(true);
  });
});
