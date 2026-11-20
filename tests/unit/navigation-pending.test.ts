import { describe, expect, it } from "vitest";
import { isInAppPageNavigation } from "@/lib/navigation-pending";

const current = {
  origin: "http://localhost:3001",
  pathname: "/",
  search: "",
};

describe("isInAppPageNavigation (#158)", () => {
  it("accepts in-app path changes", () => {
    expect(isInAppPageNavigation("/masseur/login", current)).toBe(true);
    expect(isInAppPageNavigation("/client/login", current)).toBe(true);
    expect(
      isInAppPageNavigation("http://localhost:3001/masseur/login", current),
    ).toBe(true);
  });

  it("rejects same-page, hash-only, external, and non-navigation hrefs", () => {
    expect(isInAppPageNavigation("/", current)).toBe(false);
    expect(isInAppPageNavigation("/#section", current)).toBe(false);
    expect(isInAppPageNavigation("#section", current)).toBe(false);
    expect(isInAppPageNavigation("mailto:a@b.c", current)).toBe(false);
    expect(isInAppPageNavigation("https://example.com/x", current)).toBe(false);
  });

  it("accepts query changes on the same path", () => {
    expect(
      isInAppPageNavigation("/masseur/dashboard?slot=1", {
        origin: "http://localhost:3001",
        pathname: "/masseur/dashboard",
        search: "",
      }),
    ).toBe(true);
  });
});
