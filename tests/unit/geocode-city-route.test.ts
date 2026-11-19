/**
 * #113 — geocode city route auth, rate limits, cache, no live Nominatim.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePortalUser = vi.fn();
const checkRateLimit = vi.fn();
const fetchNominatimMock = vi.fn();
const cacheGet = vi.fn();
const cacheSet = vi.fn();

vi.mock("@/lib/notifications/portal-gate", () => ({
  requirePortalUser: (...args: unknown[]) => requirePortalUser(...args),
}));

vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return {
    ...actual,
    RATE_LIMITS: {
      ...actual.RATE_LIMITS,
      geocodeNominatimGlobal: { limit: 1, windowMs: 1000 },
      geocodeUser: { limit: 30, windowMs: 60 * 60 * 1000 },
      geocodeIp: { limit: 20, windowMs: 60 * 60 * 1000 },
    },
    rateLimitKey: (scope: string, subject: string) => `${scope}:${subject}`,
    checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
  };
});

vi.mock("@/lib/request-ip", () => ({
  getClientIp: () => "203.0.113.10",
}));

vi.mock("@/lib/geocode/nominatim-city", () => ({
  fetchNominatimCityResults: (...args: unknown[]) => fetchNominatimMock(...args),
}));

vi.mock("@/lib/geocode/city-cache", () => ({
  cityGeocodeCacheKey: (q: string, lang: string) => `${lang}:${q}`,
  cityGeocodeResultCache: {
    get: (...args: unknown[]) => cacheGet(...args),
    set: (...args: unknown[]) => cacheSet(...args),
  },
}));

vi.mock("@/lib/http/route-error", () => ({
  logRouteError: vi.fn(),
}));

import { GET } from "@/app/api/geocode/city/route";

describe("GET /api/geocode/city (#113)", () => {
  beforeEach(() => {
    requirePortalUser.mockReset();
    checkRateLimit.mockReset();
    fetchNominatimMock.mockReset();
    cacheGet.mockReset();
    cacheSet.mockReset();
    checkRateLimit.mockResolvedValue({ ok: true });
    cacheGet.mockReturnValue(undefined);
  });

  it("returns 409 when portal gate is ambiguous", async () => {
    requirePortalUser.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "ambiguous_portal" }, { status: 409 }),
    });

    const res = await GET(
      new Request("http://test/api/geocode/city?q=Kyiv&lang=en"),
    );
    expect(res.status).toBe(409);
    expect(fetchNominatimMock).not.toHaveBeenCalled();
  });

  it("allows anonymous registration path and serves cache without Nominatim", async () => {
    requirePortalUser.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "unauthorized" }, { status: 401 }),
    });
    cacheGet.mockReturnValue([{ id: "1", label: "Kyiv" }]);

    const res = await GET(
      new Request("http://test/api/geocode/city?q=Kyiv&lang=en"),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      results: [{ id: "1", label: "Kyiv" }],
      cached: true,
    });
    expect(fetchNominatimMock).not.toHaveBeenCalled();
    // IP limit only (no user limit when anonymous); no global on cache hit.
    expect(checkRateLimit).toHaveBeenCalledTimes(1);
  });

  it("rate-limits authenticated user before upstream", async () => {
    requirePortalUser.mockResolvedValue({
      ok: true,
      userId: "u1",
      portal: "masseur",
    });
    checkRateLimit
      .mockResolvedValueOnce({ ok: true }) // ip
      .mockResolvedValueOnce({ ok: false, retryAfterSec: 42 }); // user

    const res = await GET(
      new Request("http://test/api/geocode/city?q=Kyiv&lang=en"),
    );
    expect(res.status).toBe(429);
    expect(fetchNominatimMock).not.toHaveBeenCalled();
  });

  it("fetches Nominatim on cache miss for authenticated masseur", async () => {
    requirePortalUser.mockResolvedValue({
      ok: true,
      userId: "m1",
      portal: "masseur",
    });
    fetchNominatimMock.mockResolvedValue([
      { id: "9", placeId: "9", label: "Odesa" },
    ]);

    const res = await GET(
      new Request("http://test/api/geocode/city?q=Odesa&lang=uk"),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      results: [{ id: "9", placeId: "9", label: "Odesa" }],
      cached: false,
    });
    expect(fetchNominatimMock).toHaveBeenCalledWith("Odesa", "uk");
    expect(cacheSet).toHaveBeenCalled();
    // ip + user + global
    expect(checkRateLimit).toHaveBeenCalledTimes(3);
  });
});
