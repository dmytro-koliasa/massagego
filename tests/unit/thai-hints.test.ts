import { describe, expect, it } from "vitest";
import { hasConsecutiveHourPair } from "@/lib/thai-hints";

describe("hasConsecutiveHourPair", () => {
  it("detects adjacent hour starts", () => {
    expect(
      hasConsecutiveHourPair([
        "2031-07-15T10:00:00.000Z",
        "2031-07-15T11:00:00.000Z",
      ]),
    ).toBe(true);
  });

  it("ignores non-adjacent selections", () => {
    expect(
      hasConsecutiveHourPair([
        "2031-07-15T10:00:00.000Z",
        "2031-07-15T12:00:00.000Z",
      ]),
    ).toBe(false);
  });

  it("needs at least two starts", () => {
    expect(hasConsecutiveHourPair(["2031-07-15T10:00:00.000Z"])).toBe(false);
    expect(hasConsecutiveHourPair([])).toBe(false);
  });
});
