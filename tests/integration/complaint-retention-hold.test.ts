/**
 * #132 — open complaints set Booking.hasRetentionHold so cleanup skips them.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  completeClientData,
  completeMasseurData,
  slotInsideBookingWindow,
} from "./fixtures";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
}

const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

describeDb("complaint retention hold (#132)", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let createComplaint: typeof import("@/lib/complaints").createComplaint;
  let processBookingCleanup: typeof import("@/lib/booking-cleanup").processBookingCleanup;
  let masseurId = "";
  let clientId = "";
  let bookingId = "";

  const slotStart = slotInsideBookingWindow(30, 10);

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    ({ createComplaint } = await import("@/lib/complaints"));
    ({ processBookingCleanup } = await import("@/lib/booking-cleanup"));

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const masseur = await prisma.user.create({
      data: completeMasseurData({
        email: `hold-m-${suffix}@test.local`,
        phone: `+38050${String(Date.now()).slice(-7)}`,
      }),
    });
    const client = await prisma.user.create({
      data: completeClientData({
        email: `hold-c-${suffix}@test.local`,
        phone: `+38067${String(Date.now()).slice(-7)}`,
      }),
    });
    masseurId = masseur.id;
    clientId = client.id;
  });

  beforeEach(async () => {
    await prisma.complaint.deleteMany({
      where: { OR: [{ reporterId: clientId }, { targetId: masseurId }] },
    });
    await prisma.booking.deleteMany({
      where: { OR: [{ masseurId }, { clientUserId: clientId }] },
    });

    const booking = await prisma.booking.create({
      data: {
        masseurId,
        clientUserId: clientId,
        clientName: "Hold Client",
        clientPhone: "+380501111111",
        slotStart,
        status: "cancelled",
        cancelledBy: "client",
        cancelledAt: new Date("2020-01-01T00:00:00.000Z"),
        massageType: "classic",
        hasRetentionHold: false,
      },
    });
    bookingId = booking.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.complaint.deleteMany({
      where: { OR: [{ reporterId: clientId }, { targetId: masseurId }] },
    });
    await prisma.booking.deleteMany({
      where: { OR: [{ masseurId }, { clientUserId: clientId }] },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [masseurId, clientId].filter(Boolean) } },
    });
    await prisma.$disconnect();
  });

  it("sets the hold on create and skips cleanup until the last open complaint closes", async () => {
    const created = await createComplaint(prisma, {
      reporterId: clientId,
      reporterPortal: "client",
      bookingId,
      category: "rude",
      body: "Was rude during the session.",
    });
    expect(created.ok).toBe(true);

    const held = await prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      select: { hasRetentionHold: true },
    });
    expect(held.hasRetentionHold).toBe(true);

    await processBookingCleanup({
      now: new Date("2031-01-01T00:00:00.000Z"),
      limit: 50,
    });
    expect(
      await prisma.booking.count({ where: { id: bookingId } }),
    ).toBe(1);

    await prisma.$transaction(async (tx) => {
      await tx.complaint.updateMany({
        where: { bookingId },
        data: {
          status: "resolved",
          resolvedAt: new Date(),
          resolvedById: masseurId,
        },
      });
      const { syncBookingRetentionHold } = await import("@/lib/complaints");
      await syncBookingRetentionHold(tx, bookingId);
    });

    const released = await prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      select: { hasRetentionHold: true },
    });
    expect(released.hasRetentionHold).toBe(false);

    await processBookingCleanup({
      now: new Date("2031-01-01T00:00:00.000Z"),
      limit: 50,
    });
    expect(
      await prisma.booking.count({ where: { id: bookingId } }),
    ).toBe(0);
  });
});
