/**
 * #203 — public site origin for SEO absolute URLs.
 */
import { describe, expect, it } from "vitest";
import {
  buildPublicSiteUrl,
  resolvePublicSiteOrigin,
} from "@/lib/seo/site-origin";

describe("resolvePublicSiteOrigin (#203)", () => {
  it("prefers SITE_URL over AUTH_URL", () => {
    expect(
      resolvePublicSiteOrigin({
        SITE_URL: "https://www.example.com/",
        AUTH_URL: "https://auth.example.com",
      }),
    ).toEqual({
      ok: true,
      origin: "https://www.example.com",
      source: "SITE_URL",
    });
  });

  it("falls back to AUTH_URL when SITE_URL is unset", () => {
    expect(
      resolvePublicSiteOrigin({ AUTH_URL: "http://localhost:3000/path" }),
    ).toEqual({
      ok: true,
      origin: "http://localhost:3000",
      source: "AUTH_URL",
    });
  });

  it("rejects missing and invalid values", () => {
    expect(resolvePublicSiteOrigin({})).toEqual({
      ok: false,
      error: "site_origin_missing",
    });
    expect(resolvePublicSiteOrigin({ SITE_URL: "not-a-url" })).toEqual({
      ok: false,
      error: "site_origin_invalid",
    });
    expect(resolvePublicSiteOrigin({ AUTH_URL: "ftp://x" })).toEqual({
      ok: false,
      error: "site_origin_invalid",
    });
  });
});

describe("buildPublicSiteUrl (#203)", () => {
  it("joins origin and path", () => {
    expect(buildPublicSiteUrl("https://www.example.com", "/privacy")).toBe(
      "https://www.example.com/privacy",
    );
    expect(buildPublicSiteUrl("https://www.example.com/", "terms")).toBe(
      "https://www.example.com/terms",
    );
  });
});
