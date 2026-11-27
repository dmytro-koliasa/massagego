import { describe, expect, it } from "vitest";
import {
  buildClientCatalogHref,
  parseCatalogSearchParams,
} from "@/lib/catalog-url";

describe("catalog URL helpers (#207 AD-3)", () => {
  it("builds shareable hrefs", () => {
    expect(buildClientCatalogHref({ city: "all", page: 2 })).toBe(
      "/client?city=all&page=2",
    );
    expect(
      buildClientCatalogHref({ city: "id:ChIJ123", page: 1 }),
    ).toBe("/client?city=id%3AChIJ123");
    expect(buildClientCatalogHref({ city: "", page: 1 })).toBe("/client");
  });

  it("parses search params from App Router shape", () => {
    expect(
      parseCatalogSearchParams({ city: "all", page: ["2"] }),
    ).toEqual({ city: "all", page: "2" });
    expect(parseCatalogSearchParams({})).toEqual({ city: null, page: null });
  });
});
