import { describe, expect, it } from "vitest";
import {
  formatRateLimitMessage,
  hashRateLimitSubject,
  isUniqueConstraintError,
  isWindowExpired,
  minutesFromRetryAfter,
  rateLimitKey,
  retryAfterSec,
} from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { hashPasswordResetToken } from "@/lib/email/password-reset";

describe("rate-limit helpers", () => {
  it("computes retryAfterSec until window end", () => {
    const windowStart = Date.parse("2030-01-01T00:00:00.000Z");
    const windowMs = 15 * 60 * 1000;
    const now = windowStart + 5 * 60 * 1000;
    expect(retryAfterSec(windowStart, windowMs, now)).toBe(10 * 60);
  });

  it("never returns retryAfterSec below 1", () => {
    const windowStart = Date.parse("2030-01-01T00:00:00.000Z");
    expect(retryAfterSec(windowStart, 1000, windowStart + 5000)).toBe(1);
  });

  it("detects an expired window", () => {
    const start = 1_000_000;
    expect(isWindowExpired(start, 60_000, start + 59_999)).toBe(false);
    expect(isWindowExpired(start, 60_000, start + 60_000)).toBe(true);
  });

  it("rounds retry seconds up to display minutes", () => {
    expect(minutesFromRetryAfter(1)).toBe(1);
    expect(minutesFromRetryAfter(60)).toBe(1);
    expect(minutesFromRetryAfter(61)).toBe(2);
    expect(minutesFromRetryAfter(15 * 60)).toBe(15);
  });

  it("formats EN and UK rate-limit messages", () => {
    expect(formatRateLimitMessage("en", 3)).toBe(
      "Too many attempts. Try again in 3 min.",
    );
    expect(formatRateLimitMessage("uk", 3)).toBe(
      "Забагато спроб. Спробуйте знову через 3 хв.",
    );
  });
});

describe("getClientIp (#115)", () => {
  const localEnv = {};

  it("ignores spoofable leftmost XFF when no trusted proxy is configured", () => {
    const request = new Request("https://example.com", {
      headers: {
        "x-forwarded-for": "203.0.113.10, 10.0.0.1",
        "x-real-ip": "198.51.100.2",
      },
    });
    expect(getClientIp(request, localEnv)).toBe("unknown");
  });

  it("prefers x-vercel-forwarded-for over XFF", () => {
    const request = new Request("https://example.com", {
      headers: {
        "x-vercel-forwarded-for": "198.51.100.9",
        "x-forwarded-for": "203.0.113.10, 10.0.0.1",
      },
    });
    expect(getClientIp(request, localEnv)).toBe("198.51.100.9");
  });

  it("uses TRUST_PROXY_HOPS from the right (append-style)", () => {
    const request = new Request("https://example.com", {
      headers: {
        "x-forwarded-for": "203.0.113.10, 198.51.100.2",
      },
    });
    expect(getClientIp(request, { TRUST_PROXY_HOPS: "1" })).toBe(
      "198.51.100.2",
    );
  });

  it("on Vercel without platform header uses rightmost XFF", () => {
    const request = new Request("https://example.com", {
      headers: {
        "x-forwarded-for": "203.0.113.10, 198.51.100.2",
      },
    });
    expect(getClientIp(request, { VERCEL: "1" })).toBe("198.51.100.2");
  });

  it("returns unknown with no usable trusted signal", () => {
    expect(getClientIp(new Request("https://example.com"), localEnv)).toBe(
      "unknown",
    );
  });
});

describe("hashPasswordResetToken", () => {
  it("hashes with stable sha256 hex", () => {
    const a = hashPasswordResetToken("abc");
    const b = hashPasswordResetToken("abc");
    const c = hashPasswordResetToken("abd");
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
    expect(a).not.toBe(c);
  });
});

describe("rateLimitKey hashing (#81)", () => {
  it("never embeds the raw subject in the key", () => {
    const phone = "+380501112233";
    const key = rateLimitKey("password-reset:id", `client:${phone}`);
    expect(key.startsWith("password-reset:id:")).toBe(true);
    expect(key.includes(phone)).toBe(false);
    expect(key.endsWith(hashRateLimitSubject(`client:${phone}`))).toBe(true);
    expect(rateLimitKey("signin:ip", "203.0.113.10")).toBe(
      rateLimitKey("signin:ip", "203.0.113.10"),
    );
  });
});

describe("isUniqueConstraintError (#85)", () => {
  it("detects Prisma P2002 and ignores other errors", () => {
    expect(isUniqueConstraintError({ code: "P2002" })).toBe(true);
    expect(isUniqueConstraintError({ code: "P2003" })).toBe(false);
    expect(isUniqueConstraintError(new Error("boom"))).toBe(false);
    expect(isUniqueConstraintError(null)).toBe(false);
  });
});
