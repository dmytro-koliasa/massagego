/**
 * #80 — outbox claim/lease: concurrent deliverers send at most once while the lease is live.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { completeClientData } from "./fixtures";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
}

const sendEmailMock = vi.hoisted(() =>
  vi.fn(
    async (): Promise<
      { ok: true } | { ok: false; error: string }
    > => {
      await new Promise((resolve) => setTimeout(resolve, 80));
      return { ok: true };
    },
  ),
);

vi.mock("@/lib/email/sender", () => ({
  sendEmail: sendEmailMock,
}));

const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

describeDb("notification outbox claim/lease", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let claimOutboxDelivery: typeof import("@/lib/notifications/outbox").claimOutboxDelivery;
  let deliverOutboxRow: typeof import("@/lib/notifications/outbox").deliverOutboxRow;

  let userId = "";
  let outboxId = "";

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    ({ claimOutboxDelivery, deliverOutboxRow } = await import(
      "@/lib/notifications/outbox"
    ));

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const user = await prisma.user.create({
      data: completeClientData({
        email: `outbox-claim-${suffix}@test.local`,
        phone: `+38050${String(Date.now()).slice(-7)}`,
        emailVerified: new Date("2030-01-01T00:00:00.000Z"),
      }),
    });
    userId = user.id;

    const row = await prisma.notificationOutbox.create({
      data: {
        userId,
        eventType: "booking_confirmed",
        channel: "email",
        status: "pending",
        nextAttemptAt: new Date(),
        payloadJson: JSON.stringify({
          locale: "en",
          slotStartIso: "2030-01-15T10:00:00.000Z",
          timeZone: "Europe/Kyiv",
          timeZoneLabel: "Kyiv, UTC+2",
          massageType: "classic",
          otherPartyName: "Test",
          cancelReasonKey: null,
          cancelReasonText: null,
          appPath: "/client",
        }),
      },
      select: { id: true },
    });
    outboxId = row.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    if (outboxId) {
      await prisma.notificationOutbox.deleteMany({ where: { id: outboxId } });
    }
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await prisma.$disconnect();
  });

  it("lets only one concurrent deliverer claim and send", async () => {
    sendEmailMock.mockClear();

    await Promise.all([
      deliverOutboxRow(outboxId),
      deliverOutboxRow(outboxId),
      deliverOutboxRow(outboxId),
    ]);

    expect(sendEmailMock).toHaveBeenCalledTimes(1);

    const row = await prisma.notificationOutbox.findUniqueOrThrow({
      where: { id: outboxId },
      select: { status: true, leaseExpiresAt: true, sentAt: true },
    });
    expect(row.status).toBe("sent");
    expect(row.sentAt).toBeInstanceOf(Date);
    expect(row.leaseExpiresAt).toBeNull();

    // Already sent — further claims fail.
    expect(await claimOutboxDelivery(outboxId)).toBe(false);
    await deliverOutboxRow(outboxId);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it("does not let a stale failure overwrite sent after reclaim", async () => {
    // Worker A claims and sends slowly (fails). Mid-flight a reclaimer marks
    // the row sent. A's markFailed must not flip sent → failed.
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const user = await prisma.user.create({
      data: completeClientData({
        email: `outbox-stale-${suffix}@test.local`,
        phone: `+38050${String(Date.now()).slice(-7)}`,
        emailVerified: new Date("2030-01-01T00:00:00.000Z"),
      }),
    });
    const created = await prisma.notificationOutbox.create({
      data: {
        userId: user.id,
        eventType: "booking_confirmed",
        channel: "email",
        status: "pending",
        nextAttemptAt: new Date(),
        payloadJson: JSON.stringify({
          locale: "en",
          slotStartIso: "2030-01-15T10:00:00.000Z",
          timeZone: "Europe/Kyiv",
          timeZoneLabel: "Kyiv, UTC+2",
          massageType: "classic",
          otherPartyName: "Test",
          cancelReasonKey: null,
          cancelReasonText: null,
          appPath: "/client",
        }),
      },
      select: { id: true },
    });

    sendEmailMock.mockClear();
    sendEmailMock.mockImplementationOnce(async () => {
      await new Promise((resolve) => setTimeout(resolve, 120));
      return { ok: false as const, error: "stale_worker_timeout" };
    });

    const deliverPromise = deliverOutboxRow(created.id);

    // Wait until A has claimed, then simulate successful reclaim → sent.
    // Fixed sleeps flake on slow CI; poll for the claim instead.
    let midStatus = "pending";
    for (let i = 0; i < 50; i += 1) {
      const mid = await prisma.notificationOutbox.findUniqueOrThrow({
        where: { id: created.id },
        select: { status: true },
      });
      midStatus = mid.status;
      if (mid.status === "processing") break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(midStatus).toBe("processing");

    await prisma.notificationOutbox.update({
      where: { id: created.id },
      data: {
        status: "sent",
        sentAt: new Date(),
        attemptCount: 1,
        nextAttemptAt: null,
        leaseExpiresAt: null,
        lastError: null,
      },
    });

    await deliverPromise;

    const after = await prisma.notificationOutbox.findUniqueOrThrow({
      where: { id: created.id },
      select: { status: true, lastError: true },
    });
    expect(after.status).toBe("sent");
    expect(after.lastError).toBeNull();
    expect(sendEmailMock).toHaveBeenCalledTimes(1);

    await prisma.notificationOutbox.deleteMany({ where: { id: created.id } });
    await prisma.user.deleteMany({ where: { id: user.id } });
  });
});
