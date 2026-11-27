import { describe, expect, it } from "vitest";
import {
  CATALOG_DEFAULT_PAGE_SIZE,
  CATALOG_MAX_PAGE_SIZE,
  normalizeCatalogQuery,
} from "@/lib/masseur-catalog-query";

describe("normalizeCatalogQuery (#207)", () => {
  const defaults = { defaultFilterValue: "id:place-default" };

  it("preserves defaults when city/page omitted", () => {
    expect(normalizeCatalogQuery({}, defaults)).toEqual({
      page: 1,
      pageSize: CATALOG_DEFAULT_PAGE_SIZE,
      requestedCity: "id:place-default",
    });
  });

  it("accepts all + pagination", () => {
    expect(
      normalizeCatalogQuery({ city: "all", page: "2", pageSize: "9" }, defaults),
    ).toEqual({
      page: 2,
      pageSize: 9,
      requestedCity: "all",
    });
  });

  it("handles malformed and out-of-range values safely", () => {
    expect(
      normalizeCatalogQuery(
        { page: "0", pageSize: "999", city: "  " },
        defaults,
      ),
    ).toEqual({
      page: 1,
      pageSize: CATALOG_MAX_PAGE_SIZE,
      requestedCity: "id:place-default",
    });

    expect(
      normalizeCatalogQuery(
        { page: "nope", pageSize: "-3", city: "name:Kyiv" },
        defaults,
      ),
    ).toEqual({
      page: 1,
      // Finite negative values clamp to 1 (preserved API semantics).
      pageSize: 1,
      requestedCity: "name:Kyiv",
    });

    expect(
      normalizeCatalogQuery(
        { page: "nope", pageSize: "abc", city: "name:Kyiv" },
        defaults,
      ),
    ).toEqual({
      page: 1,
      pageSize: CATALOG_DEFAULT_PAGE_SIZE,
      requestedCity: "name:Kyiv",
    });
  });
});

