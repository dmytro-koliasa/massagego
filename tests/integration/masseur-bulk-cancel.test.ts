/**
 * Masseur bulk-cancel (X-4): cancel all future confirmed bookings.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { completeClientData, completeMasseurData } from "./fixtures";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
}

vi.mock("@/lib/notifications/outbox", () => ({
  notifyMasseurCancelledBooking: vi.fn(async () => undefined),
}));

const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

describeDb("masseur bulk-cancel", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let bulkCancelMasseurFutureBookings: typeof import("@/lib/masseur-bulk-cancel").bulkCancelMasseurFutureBookings;
  let countMasseurFutureBookings: typeof import("@/lib/masseur-bulk-cancel").countMasseurFutureBookings;
  let notifyMasseurCancelledBooking: ReturnType<typeof vi.fn>;

  let masseurId = "";
  let clientId = "";
  const bookingIds: string[] = [];

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    ({
      bulkCancelMasseurFutureBookings,
      countMasseurFutureBookings,
    } = await import("@/lib/masseur-bulk-cancel"));
    notifyMasseurCancelledBooking = vi.mocked(
      (await import("@/lib/notifications/outbox")).notifyMasseurCancelledBooking,
    );

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const masseur = await prisma.user.create({
      data: completeMasseurData({
        email: `masseur-bulk-${suffix}@test.local`,
        phone: `+38050${String(Date.now()).slice(-7)}`,
      }),
    });
    const client = await prisma.user.create({
      data: completeClientData({
        email: `client-bulk-${suffix}@test.local`,
        phone: `+38067${String(Date.now()).slice(-7)}`,
      }),
    });
    masseurId = masseur.id;
    clientId = client.id;

    for (let i = 0; i < 2; i += 1) {
      const slotStart = new Date();
      slotStart.setUTCDate(slotStart.getUTCDate() + 7 + i);
      slotStart.setUTCHours(10, 0, 0, 0);
      const booking = await prisma.booking.create({
        data: {
          masseurId,
          clientUserId: clientId,
          clientName: "Bulk Client",
          clientPhone: "+380501111111",
          slotStart,
          status: "confirmed",
          massageType: "classic",
        },
      });
      bookingIds.push(booking.id);

      await prisma.availabilitySlot.create({
        data: {
          masseurId,
          start: slotStart,
          end: new Date(slotStart.getTime() + 60 * 60 * 1000),
        },
      });
    }

    const walkInStart = new Date();
    walkInStart.setUTCDate(walkInStart.getUTCDate() + 9);
    walkInStart.setUTCHours(11, 0, 0, 0);
    const walkIn = await prisma.booking.create({
      data: {
        masseurId,
        clientUserId: null,
        clientName: "Walk-in",
        clientPhone: "+380501111112",
        slotStart: walkInStart,
        status: "confirmed",
        massageType: "classic",
      },
    });
    bookingIds.push(walkIn.id);
  });

  afterAll(async () => {
    if (!prisma) return;
    if (bookingIds.length > 0) {
      await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
    }
    if (masseurId) {
      await prisma.availabilitySlot.deleteMany({ where: { masseurId } });
      await prisma.user.deleteMany({
        where: { id: { in: [masseurId, clientId].filter(Boolean) } },
      });
    }
    await prisma.$disconnect();
  });

  it("cancels all future bookings, keeps availability, notifies account clients only", async () => {
    expect(await countMasseurFutureBookings(masseurId)).toBe(3);

    const result = await bulkCancelMasseurFutureBookings({
      masseurId,
      availability: "available",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.cancelledCount).toBe(3);
    expect(result.notifiedCount).toBe(2);
    expect(notifyMasseurCancelledBooking).toHaveBeenCalledTimes(2);

    expect(await countMasseurFutureBookings(masseurId)).toBe(0);

    const cancelled = await prisma.booking.findMany({
      where: { id: { in: bookingIds } },
      select: { status: true, cancelledBy: true },
    });
    expect(cancelled.every((row) => row.status === "cancelled")).toBe(true);
    expect(cancelled.every((row) => row.cancelledBy === "masseur")).toBe(true);

    const slots = await prisma.availabilitySlot.count({
      where: { masseurId },
    });
    expect(slots).toBeGreaterThanOrEqual(2);

    const empty = await bulkCancelMasseurFutureBookings({
      masseurId,
      availability: "unavailable",
    });
    expect(empty).toEqual({ ok: false, error: "none_found" });
  });
});
