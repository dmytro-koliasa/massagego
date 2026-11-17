import { NextResponse } from "next/server";
import {
  formatRateLimitMessage,
  minutesFromRetryAfter,
} from "@/lib/rate-limit";

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
