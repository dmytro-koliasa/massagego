import { NextResponse } from "next/server";
import {
  checkRateLimit,
  formatRateLimitMessage,
  minutesFromRetryAfter,
  rateLimitKey,
} from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

export function rateLimitJsonResponse(
  retryAfterSec: number,
  locale: "en" | "uk" = "en",
) {
  const minutes = minutesFromRetryAfter(retryAfterSec);
  const message = formatRateLimitMessage(locale, minutes);
  return NextResponse.json(
    { error: "rate_limited", message, retryAfterSec },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    },
  );
}

type LimitWindow = { limit: number; windowMs: number };

/**
 * IP then account sliding-window checks (#180). Returns a 429 response or null.
 */
export async function enforceIpAccountRateLimit(options: {
  request: Request;
  userId: string;
  ipScope: string;
  accountScope: string;
  ip: LimitWindow;
  account: LimitWindow;
  locale?: "en" | "uk";
}): Promise<NextResponse | null> {
  const locale =
    options.locale ?? resolveRequestLocale(options.request);
  const ipLimit = await checkRateLimit(
    rateLimitKey(options.ipScope, getClientIp(options.request)),
    options.ip.limit,
    options.ip.windowMs,
  );
  if (!ipLimit.ok) {
    return rateLimitJsonResponse(ipLimit.retryAfterSec, locale);
  }
  const accountLimit = await checkRateLimit(
    rateLimitKey(options.accountScope, options.userId),
    options.account.limit,
    options.account.windowMs,
  );
  if (!accountLimit.ok) {
    return rateLimitJsonResponse(accountLimit.retryAfterSec, locale);
  }
  return null;
}

export function resolveRequestLocale(
  request: Request,
  preferredLocale?: unknown,
): "en" | "uk" {
  if (preferredLocale === "uk" || preferredLocale === "en") {
    return preferredLocale;
  }
  const cookie = request.headers.get("cookie") ?? "";
  const match = /(?:^|;\s*)serein-locale=(en|uk)(?:;|$)/.exec(cookie);
  if (match?.[1] === "uk" || match?.[1] === "en") {
    return match[1];
  }
  const accept = request.headers.get("accept-language")?.toLowerCase() ?? "";
  return accept.startsWith("uk") ? "uk" : "en";
}
