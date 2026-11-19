/**
 * #85 — concurrent first inserts on an empty rate-limit key must not 500 (P2002).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
}

const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

describeDb("rate-limit first-insert concurrency", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let checkRateLimit: typeof import("@/lib/rate-limit").checkRateLimit;
  let rateLimitKey: typeof import("@/lib/rate-limit").rateLimitKey;

  const bucketKeys: string[] = [];

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    ({ checkRateLimit, rateLimitKey } = await import("@/lib/rate-limit"));
  });

  afterAll(async () => {
    if (!prisma) return;
    if (bucketKeys.length > 0) {
      await prisma.rateLimitBucket.deleteMany({
        where: { key: { in: bucketKeys } },
      });
    }
    await prisma.$disconnect();
  });

  it("parallel first requests on an empty key do not throw and count every hit", async () => {
    const key = rateLimitKey(
      "test-first-insert",
      `parallel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    );
    bucketKeys.push(key);

    const limit = 8;
    const windowMs = 15 * 60 * 1000;
    const nowMs = Date.parse("2030-06-01T12:00:00.000Z");
    const parallel = 8;

    const results = await Promise.all(
      Array.from({ length: parallel }, () =>
        checkRateLimit(key, limit, windowMs, nowMs),
      ),
    );

    expect(results.every((r) => r.ok)).toBe(true);

    const bucket = await prisma.rateLimitBucket.findUniqueOrThrow({
      where: { key },
      select: { count: true },
    });
    expect(bucket.count).toBe(parallel);
  });

  it("still enforces the limit under concurrent first hits", async () => {
    const key = rateLimitKey(
      "test-first-insert",
      `limit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    );
    bucketKeys.push(key);

    const limit = 3;
    const windowMs = 15 * 60 * 1000;
    const nowMs = Date.parse("2030-06-01T13:00:00.000Z");
    const parallel = 8;

    const results = await Promise.all(
      Array.from({ length: parallel }, () =>
        checkRateLimit(key, limit, windowMs, nowMs),
      ),
    );

    const okCount = results.filter((r) => r.ok).length;
    const denied = results.filter((r) => !r.ok);
    expect(okCount).toBe(limit);
    expect(denied).toHaveLength(parallel - limit);
    expect(denied.every((r) => !r.ok && r.retryAfterSec >= 1)).toBe(true);

    const bucket = await prisma.rateLimitBucket.findUniqueOrThrow({
      where: { key },
      select: { count: true },
    });
    expect(bucket.count).toBe(limit);
  });
});
