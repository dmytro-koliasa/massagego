/**
 * #127 — read-only fail-ceiling peek (no increment).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    rateLimitBucket: {
      findUnique: (...args: unknown[]) => findUnique(...args),
    },
  },
}));

describe("isRateLimitExceeded (#127)", () => {
  beforeEach(() => {
    findUnique.mockReset();
  });

  it("is false when no bucket exists", async () => {
    findUnique.mockResolvedValue(null);
    const { isRateLimitExceeded } = await import("@/lib/rate-limit");
    await expect(
      isRateLimitExceeded("signin:fail:abc", 30, 15 * 60 * 1000, 1_000_000),
    ).resolves.toBe(false);
  });

  it("is false when the window has expired", async () => {
    findUnique.mockResolvedValue({
      windowStart: new Date(0),
      count: 99,
    });
    const { isRateLimitExceeded } = await import("@/lib/rate-limit");
    await expect(
      isRateLimitExceeded("signin:fail:abc", 30, 15 * 60 * 1000, 1_000_000),
    ).resolves.toBe(false);
  });

  it("is true when count is at the limit inside the window", async () => {
    const nowMs = 1_000_000;
    findUnique.mockResolvedValue({
      windowStart: new Date(nowMs - 60_000),
      count: 30,
    });
    const { isRateLimitExceeded } = await import("@/lib/rate-limit");
    await expect(
      isRateLimitExceeded("signin:fail:abc", 30, 15 * 60 * 1000, nowMs),
    ).resolves.toBe(true);
  });

  it("is false when count is under the limit", async () => {
    const nowMs = 1_000_000;
    findUnique.mockResolvedValue({
      windowStart: new Date(nowMs - 60_000),
      count: 29,
    });
    const { isRateLimitExceeded } = await import("@/lib/rate-limit");
    await expect(
      isRateLimitExceeded("signin:fail:abc", 30, 15 * 60 * 1000, nowMs),
    ).resolves.toBe(false);
  });
});
