/**
 * #204 — non-owner client cannot cancel another client's booking.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import "./mock-rate-limit";
import { completeMasseurData } from "./fixtures";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
}

const session = vi.hoisted(() => ({ clientId: "" }));

vi.mock("@/lib/client-session.server", () => ({
  requireClientSession: async () => ({ ok: true, userId: session.clientId }),
}));

vi.mock("@/lib/notifications/outbox", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/notifications/outbox")
  >("@/lib/notifications/outbox");
  return {
    ...actual,
    notifyClientCancelledBooking: async () => undefined,
  };
});

const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

describeDb("booking cancel ownership (#204)", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let cancelBooking: typeof import("@/app/api/bookings/cancel/route").POST;
  let ownerId = "";
  let otherId = "";
  let masseurId = "";
  let bookingId = "";

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    ({ POST: cancelBooking } = await import(
      "@/app/api/bookings/cancel/route"
    ));

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const masseur = await prisma.user.create({
      data: completeMasseurData({
        email: `own-m-${suffix}@test.local`,
        phone: `+38067${String(Date.now()).slice(-7)}`,
        cancelCutoffHours: 0,
      }),
    });
    const owner = await prisma.user.create({
      data: {
        email: `own-c-${suffix}@test.local`,
        portal: "client",
        name: "Owner Client",
      },
    });
    const other = await prisma.user.create({
      data: {
        email: `other-c-${suffix}@test.local`,
        portal: "client",
        name: "Other Client",
      },
    });
    const slotStart = new Date(Date.now() + 48 * 60 * 60 * 1000);
    slotStart.setMinutes(0, 0, 0);
    const booking = await prisma.booking.create({
      data: {
        masseurId: masseur.id,
        clientUserId: owner.id,
        clientName: "Owner",
        clientPhone: "+380501112233",
        slotStart,
        status: "confirmed",
      },
    });

    ownerId = owner.id;
    otherId = other.id;
    masseurId = masseur.id;
    bookingId = booking.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    if (bookingId) {
      await prisma.booking.deleteMany({ where: { id: bookingId } });
    }
    await prisma.user.deleteMany({
      where: { id: { in: [ownerId, otherId, masseurId].filter(Boolean) } },
    });
    await prisma.$disconnect();
  });

  it("returns not_found when another client tries to cancel", async () => {
    session.clientId = otherId;
    const res = await cancelBooking(
      new Request("http://test/api/bookings/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bookingId,
          cancelReason: "cant_make_it",
        }),
      }),
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("not_found");

    const still = await prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      select: { status: true, clientUserId: true },
    });
    expect(still.status).toBe("confirmed");
    expect(still.clientUserId).toBe(ownerId);
  });
});
