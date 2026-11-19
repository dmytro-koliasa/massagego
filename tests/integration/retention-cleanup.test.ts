/**
 * #81 — outbox + rate-limit retention cleanup keeps in-window rows.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { completeClientData } from "./fixtures";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
}

const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

describeDb("retention cleanup (outbox + rate-limit)", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let deleteExpiredOutboxRows: typeof import("@/lib/notifications/outbox-cleanup").deleteExpiredOutboxRows;
  let deleteExpiredRateLimitBuckets: typeof import("@/lib/rate-limit").deleteExpiredRateLimitBuckets;
  let rateLimitKey: typeof import("@/lib/rate-limit").rateLimitKey;

  let userId = "";
  const outboxIds: string[] = [];
  const bucketIds: string[] = [];

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    ({ deleteExpiredOutboxRows } = await import(
      "@/lib/notifications/outbox-cleanup"
    ));
    ({ deleteExpiredRateLimitBuckets, rateLimitKey } = await import(
      "@/lib/rate-limit"
    ));

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const user = await prisma.user.create({
      data: completeClientData({
        email: `retention-${suffix}@test.local`,
        phone: `+38050${String(Date.now()).slice(-7)}`,
        emailVerified: new Date("2030-01-01T00:00:00.000Z"),
      }),
    });
    userId = user.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    if (outboxIds.length > 0) {
      await prisma.notificationOutbox.deleteMany({
        where: { id: { in: outboxIds } },
      });
    }
    if (bucketIds.length > 0) {
      await prisma.rateLimitBucket.deleteMany({
        where: { id: { in: bucketIds } },
      });
    }
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await prisma.$disconnect();
  });

  it("deletes aged terminal/abandoned outbox and keeps recent retry rows", async () => {
    const now = new Date("2026-11-17T12:00:00.000Z");
    const payload = JSON.stringify({
      locale: "en",
      slotStartIso: "2030-01-15T10:00:00.000Z",
      timeZone: "Europe/Kyiv",
      timeZoneLabel: "Kyiv, UTC+2",
      massageType: "classic",
      otherPartyName: "Test",
      cancelReasonKey: null,
      cancelReasonText: null,
      appPath: "/client",
    });

    const oldSent = await prisma.notificationOutbox.create({
      data: {
        userId,
        eventType: "booking_confirmed",
        channel: "email",
        status: "sent",
        sentAt: new Date("2026-11-01T12:00:00.000Z"),
        payloadJson: payload,
      },
    });
    const freshPending = await prisma.notificationOutbox.create({
      data: {
        userId,
        eventType: "booking_confirmed",
        channel: "email",
        status: "pending",
        nextAttemptAt: now,
        createdAt: new Date("2026-11-17T10:00:00.000Z"),
        payloadJson: payload,
      },
    });
    const abandonedPending = await prisma.notificationOutbox.create({
      data: {
        userId,
        eventType: "booking_confirmed",
        channel: "email",
        status: "pending",
        nextAttemptAt: now,
        createdAt: new Date("2026-11-14T12:00:00.000Z"),
        payloadJson: payload,
      },
    });
    outboxIds.push(oldSent.id, freshPending.id, abandonedPending.id);

    const result = await deleteExpiredOutboxRows({ now, limit: 50 });
    expect(result.deletedTerminal).toBeGreaterThanOrEqual(1);
    expect(result.deletedAbandoned).toBeGreaterThanOrEqual(1);

    const remaining = await prisma.notificationOutbox.findMany({
      where: { id: { in: [oldSent.id, freshPending.id, abandonedPending.id] } },
      select: { id: true, status: true },
    });
    expect(remaining.map((row) => row.id)).toEqual([freshPending.id]);
  });

  it("deletes idle rate-limit buckets and keeps active windows", async () => {
    const now = new Date("2026-11-17T12:00:00.000Z");
    const oldKey = rateLimitKey("signin:ip", `old-${Date.now()}`);
    const freshKey = rateLimitKey("signin:ip", `fresh-${Date.now()}`);

    const oldBucket = await prisma.rateLimitBucket.create({
      data: {
        key: oldKey,
        windowStart: new Date("2026-11-15T12:00:00.000Z"),
        count: 1,
      },
    });
    const freshBucket = await prisma.rateLimitBucket.create({
      data: {
        key: freshKey,
        windowStart: new Date("2026-11-17T11:30:00.000Z"),
        count: 1,
      },
    });
    bucketIds.push(oldBucket.id, freshBucket.id);

    const result = await deleteExpiredRateLimitBuckets({ now, limit: 50 });
    expect(result.deleted).toBeGreaterThanOrEqual(1);

    const remaining = await prisma.rateLimitBucket.findMany({
      where: { id: { in: [oldBucket.id, freshBucket.id] } },
      select: { id: true },
    });
    expect(remaining.map((row) => row.id)).toEqual([freshBucket.id]);
  });
});
