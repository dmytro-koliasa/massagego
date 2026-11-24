/**
 * Phase 8 #180 / SC-4 — gallery upload returns 429 when rate-limited.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireMasseurSession = vi.fn();
const checkRateLimit = vi.fn();
const storeUpload = vi.fn();
const galleryCount = vi.fn();

vi.mock("@/lib/masseur-session.server", () => ({
  requireMasseurSession: (...args: unknown[]) => requireMasseurSession(...args),
}));

vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return {
    ...actual,
    rateLimitKey: (scope: string, subject: string) => `${scope}:${subject}`,
    checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
  };
});

vi.mock("@/lib/request-ip", () => ({
  getClientIp: () => "203.0.113.10",
}));

vi.mock("@/lib/uploads", () => ({
  storeUpload: (...args: unknown[]) => storeUpload(...args),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    galleryImage: {
      count: (...args: unknown[]) => galleryCount(...args),
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/http/route-error", () => ({
  logRouteError: vi.fn(),
}));

import { POST } from "@/app/api/masseur/gallery/route";
import { RATE_LIMITS } from "@/lib/rate-limit";

describe("POST /api/masseur/gallery rate limit (#180)", () => {
  beforeEach(() => {
    requireMasseurSession.mockReset();
    checkRateLimit.mockReset();
    storeUpload.mockReset();
    galleryCount.mockReset();
    requireMasseurSession.mockResolvedValue({ ok: true, userId: "m1" });
    checkRateLimit.mockResolvedValue({ ok: true });
    galleryCount.mockResolvedValue(0);
  });

  it("exposes FR-3 gallery limit constants", () => {
    expect(RATE_LIMITS.galleryUploadIp).toEqual({
      limit: 20,
      windowMs: 15 * 60 * 1000,
    });
    expect(RATE_LIMITS.galleryUploadAccount).toEqual({
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });
    expect(RATE_LIMITS.availabilityWrite.limit).toBe(60);
    expect(RATE_LIMITS.masseurBookingCreate.limit).toBe(30);
    expect(RATE_LIMITS.profileWriteIp.limit).toBe(30);
    expect(RATE_LIMITS.profileWriteAccount.limit).toBe(20);
    expect(RATE_LIMITS.verifyEmailResend).toEqual({
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
  });

  it("returns 429 when the account rate limit is exceeded", async () => {
    checkRateLimit
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, retryAfterSec: 120 });

    const res = await POST(
      new Request("http://test/api/masseur/gallery", {
        method: "POST",
        body: new FormData(),
      }),
    );

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("rate_limited");
    expect(body.retryAfterSec).toBe(120);
    expect(storeUpload).not.toHaveBeenCalled();
    expect(checkRateLimit).toHaveBeenCalledTimes(2);
  });
});
