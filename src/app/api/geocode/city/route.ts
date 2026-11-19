import { NextResponse } from "next/server";
import {
  cityGeocodeCacheKey,
  cityGeocodeResultCache,
} from "@/lib/geocode/city-cache";
import {
  fetchNominatimCityResults,
  type GeocodeCitySuggestion,
} from "@/lib/geocode/nominatim-city";
import {
  rateLimitJsonResponse,
  resolveRequestLocale,
} from "@/lib/http/rate-limit-response";
import { logRouteError } from "@/lib/http/route-error";
import { requirePortalUser } from "@/lib/notifications/portal-gate";
import { checkRateLimit, RATE_LIMITS, rateLimitKey } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { CITY_MAX, CITY_QUERY_MIN } from "@/lib/validation";

/**
 * City search proxy for Nominatim (#113).
 *
 * - Authenticated client or masseur: preferred (BR-017 + masseur profile).
 * - Anonymous: allowed only under IP + global Nominatim budgets so client
 *   registration can still pick a canonical city without a session (BR-017).
 * - Cache hits skip upstream and the global Nominatim bucket.
 */
export async function GET(request: Request) {
  const locale = resolveRequestLocale(request);
  const gate = await requirePortalUser();
  let userId: string | null = null;

  if (gate.ok) {
    userId = gate.userId;
  } else if (gate.response.status === 409) {
    return gate.response;
  }
  // else: anonymous registration path (BR-017) — rate-limited below.

  const ip = getClientIp(request);
  const ipLimit = await checkRateLimit(
    rateLimitKey("geocode:ip", ip),
    RATE_LIMITS.geocodeIp.limit,
    RATE_LIMITS.geocodeIp.windowMs,
  );
  if (!ipLimit.ok) {
    return rateLimitJsonResponse(ipLimit.retryAfterSec, locale);
  }

  if (userId) {
    const userLimit = await checkRateLimit(
      rateLimitKey("geocode:user", userId),
      RATE_LIMITS.geocodeUser.limit,
      RATE_LIMITS.geocodeUser.windowMs,
    );
    if (!userLimit.ok) {
      return rateLimitJsonResponse(userLimit.retryAfterSec, locale);
    }
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const lang = searchParams.get("lang") === "en" ? "en" : "uk";

  if (q.length < CITY_QUERY_MIN || q.length > CITY_MAX) {
    return NextResponse.json({ results: [] });
  }

  const cacheKey = cityGeocodeCacheKey(q, lang);
  const cached = cityGeocodeResultCache.get(cacheKey) as
    | GeocodeCitySuggestion[]
    | undefined;
  if (cached) {
    return NextResponse.json({ results: cached, cached: true });
  }

  const globalLimit = await checkRateLimit(
    rateLimitKey("geocode:nominatim:global", "app"),
    RATE_LIMITS.geocodeNominatimGlobal.limit,
    RATE_LIMITS.geocodeNominatimGlobal.windowMs,
  );
  if (!globalLimit.ok) {
    return rateLimitJsonResponse(globalLimit.retryAfterSec, locale);
  }

  try {
    const results = await fetchNominatimCityResults(q, lang);
    cityGeocodeResultCache.set(cacheKey, results);
    return NextResponse.json({ results, cached: false });
  } catch (error) {
    logRouteError("geocode/city", error);
    return NextResponse.json({ results: [] }, { status: 502 });
  }
}
