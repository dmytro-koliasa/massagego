/**
 * #130 — bulk cancel takes lockMasseurBookings so a concurrent booking create
 * cannot sneak in between findMany and updateMany.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import "./mock-rate-limit";
import {
  completeClientData,
  completeMasseurData,
  slotInsideBookingWindow,
} from "./fixtures";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
}

const session = vi.hoisted(() => ({ clientId: "", masseurId: "" }));

vi.mock("@/lib/client-session.server", () => ({
  requireClientSession: async () => ({ ok: true, userId: session.clientId }),
}));

vi.mock("@/lib/notifications/outbox", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/notifications/outbox")>();
  return {
    ...actual,
    notifyMasseurCancelledBooking: vi.fn(async () => undefined),
  };
});

const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

describeDb("masseur bulk-cancel lock (#130)", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let bulkCancelMasseurFutureBookings: typeof import("@/lib/masseur-bulk-cancel").bulkCancelMasseurFutureBookings;
  let clientPost: typeof import("@/app/api/bookings/route").POST;
  let notifyMasseurCancelledBooking: ReturnType<typeof vi.fn>;
  let masseurId = "";
  let clientId = "";

  const HOUR = 60 * 60 * 1000;
  const slotA = slotInsideBookingWindow(20, 10);
  const slotB = slotInsideBookingWindow(21, 11);

  function bookRequest(start: Date) {
    return new Request("http://test/api/bookings", {
      method: "POST",
      body: JSON.stringify({
        masseurId,
        slotStarts: [start.toISOString()],
      }),
    });
  }

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    ({ bulkCancelMasseurFutureBookings } = await import(
      "@/lib/masseur-bulk-cancel"
    ));
    ({ POST: clientPost } = await import("@/app/api/bookings/route"));
    notifyMasseurCancelledBooking = vi.mocked(
      (await import("@/lib/notifications/outbox")).notifyMasseurCancelledBooking,
    );

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const masseur = await prisma.user.create({
      data: completeMasseurData({
        email: `bulk-lock-m-${suffix}@test.local`,
        phone: `+38050${String(Date.now()).slice(-7)}`,
      }),
    });
    const client = await prisma.user.create({
      data: completeClientData({
        email: `bulk-lock-c-${suffix}@test.local`,
        phone: `+38067${String(Date.now()).slice(-7)}`,
      }),
    });
    masseurId = masseur.id;
    clientId = client.id;
    session.masseurId = masseur.id;
    session.clientId = client.id;
  });

  beforeEach(async () => {
    notifyMasseurCancelledBooking.mockClear();
    await prisma.booking.deleteMany({
      where: { OR: [{ masseurId }, { clientUserId: clientId }] },
    });
    await prisma.availabilitySlot.deleteMany({ where: { masseurId } });
    await prisma.availabilitySlot.createMany({
      data: [
        { masseurId, start: slotA, end: new Date(slotA.getTime() + HOUR) },
        { masseurId, start: slotB, end: new Date(slotB.getTime() + HOUR) },
      ],
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.booking.deleteMany({
      where: { OR: [{ masseurId }, { clientUserId: clientId }] },
    });
    await prisma.availabilitySlot.deleteMany({ where: { masseurId } });
    await prisma.user.deleteMany({
      where: { id: { in: [masseurId, clientId].filter(Boolean) } },
    });
    await prisma.$disconnect();
  });

  it("cancels seeded bookings even when a concurrent create runs (#130)", async () => {
    const seeded = await prisma.booking.create({
      data: {
        masseurId,
        clientUserId: clientId,
        clientName: "Seeded",
        clientPhone: "+380501111111",
        slotStart: slotA,
        status: "confirmed",
        massageType: "classic",
      },
    });

    const [cancelResult, bookRes] = await Promise.all([
      bulkCancelMasseurFutureBookings({
        masseurId,
        availability: "available",
      }),
      clientPost(bookRequest(slotB)),
    ]);

    expect(cancelResult.ok).toBe(true);
    expect([201, 409]).toContain(bookRes.status);

    const seededRow = await prisma.booking.findUniqueOrThrow({
      where: { id: seeded.id },
      select: { status: true, cancelledBy: true },
    });
    expect(seededRow.status).toBe("cancelled");
    expect(seededRow.cancelledBy).toBe("masseur");

    const confirmed = await prisma.booking.findMany({
      where: {
        masseurId,
        status: "confirmed",
        slotStart: { gt: new Date() },
      },
      select: { id: true, slotStart: true },
    });

    // With the lock, a create either finishes before cancel (and is cancelled)
    // or after cancel (and may remain confirmed). A race survivor of the seeded
    // row is impossible.
    for (const row of confirmed) {
      expect(row.id).not.toBe(seeded.id);
    }

    if (cancelResult.ok) {
      // Account client on cancelled rows still get event 3 attempts.
      expect(notifyMasseurCancelledBooking.mock.calls.length).toBeGreaterThan(0);
    }
  });

  it("returns none_found when there is nothing to cancel", async () => {
    const empty = await bulkCancelMasseurFutureBookings({
      masseurId,
      availability: "unavailable",
    });
    expect(empty).toEqual({ ok: false, error: "none_found" });
    expect(notifyMasseurCancelledBooking).not.toHaveBeenCalled();
  });
});
