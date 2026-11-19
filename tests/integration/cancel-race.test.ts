/**
 * #82 — concurrent client + masseur cancel: one winner, correct cancelledBy,
 * single notification for the winning cancel.
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

const notifyClientMock = vi.hoisted(() => vi.fn(async () => undefined));
const notifyMasseurMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("@/lib/client-session.server", () => ({
  requireClientSession: async () => ({ ok: true, userId: session.clientId }),
}));
vi.mock("@/auth/masseur", () => ({
  auth: async () => ({ user: { id: session.masseurId } }),
}));
vi.mock("@/lib/notifications/outbox", async () => {
  const actual = await vi.importActual<typeof import("@/lib/notifications/outbox")>(
    "@/lib/notifications/outbox",
  );
  return {
    ...actual,
    notifyClientCancelledBooking: notifyClientMock,
    notifyMasseurCancelledBooking: notifyMasseurMock,
  };
});

const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

describeDb("booking cancel race (#82)", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let clientPost: typeof import("@/app/api/bookings/route").POST;
  let clientCancel: typeof import("@/app/api/bookings/cancel/route").POST;
  let masseurResolve: typeof import("@/app/api/masseur/bookings/resolve/route").POST;
  let masseurId: string;

  const HOUR = 60 * 60 * 1000;
  const base = slotInsideBookingWindow(16, 11);

  function post(url: string, body: unknown) {
    return new Request(`http://test${url}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async function bookAsClient(start: Date) {
    await prisma.availabilitySlot.create({
      data: { masseurId, start, end: new Date(start.getTime() + HOUR) },
    });
    const response = await clientPost(
      post("/api/bookings", {
        masseurId,
        slotStarts: [start.toISOString()],
      }),
    );
    expect(response.status).toBe(201);
    const { bookings } = await response.json();
    return bookings[0].id as string;
  }

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    ({ POST: clientPost } = await import("@/app/api/bookings/route"));
    ({ POST: clientCancel } = await import("@/app/api/bookings/cancel/route"));
    ({ POST: masseurResolve } = await import(
      "@/app/api/masseur/bookings/resolve/route"
    ));

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const masseur = await prisma.user.create({
      data: completeMasseurData({ email: `cancel-race-m-${suffix}@test.local` }),
    });
    const client = await prisma.user.create({
      data: completeClientData({
        email: `cancel-race-c-${suffix}@test.local`,
        name: "Cancel Race Client",
        phone: `+38050${String(Date.now()).slice(-7)}`,
      }),
    });
    masseurId = masseur.id;
    session.masseurId = masseur.id;
    session.clientId = client.id;
  });

  beforeEach(async () => {
    notifyClientMock.mockClear();
    notifyMasseurMock.mockClear();
    await prisma.booking.deleteMany({ where: { masseurId } });
    await prisma.availabilitySlot.deleteMany({ where: { masseurId } });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.booking.deleteMany({ where: { masseurId } });
    await prisma.availabilitySlot.deleteMany({ where: { masseurId } });
    await prisma.user.deleteMany({
      where: { id: { in: [masseurId, session.clientId].filter(Boolean) } },
    });
    await prisma.$disconnect();
  });

  it("lets only one of concurrent client and masseur cancel win cancelledBy", async () => {
    const id = await bookAsClient(base);

    const [clientRes, masseurRes] = await Promise.all([
      clientCancel(
        post("/api/bookings/cancel", {
          bookingId: id,
          cancelReason: "changed_mind",
        }),
      ),
      masseurResolve(
        post("/api/masseur/bookings/resolve", {
          slotStart: base.toISOString(),
          availability: "available",
        }),
      ),
    ]);

    expect(clientRes.status).toBe(200);
    expect(masseurRes?.status).toBe(200);

    const booking = await prisma.booking.findUniqueOrThrow({ where: { id } });
    expect(booking.status).toBe("cancelled");
    expect(["client", "masseur"]).toContain(booking.cancelledBy);

    if (booking.cancelledBy === "client") {
      expect(booking.cancelReason).toBe("changed_mind");
      expect(notifyClientMock).toHaveBeenCalledTimes(1);
      expect(notifyMasseurMock).toHaveBeenCalledTimes(0);
    } else {
      expect(booking.cancelReason).toBeNull();
      expect(notifyMasseurMock).toHaveBeenCalledTimes(1);
      expect(notifyClientMock).toHaveBeenCalledTimes(0);
    }

    expect(
      notifyClientMock.mock.calls.length + notifyMasseurMock.mock.calls.length,
    ).toBe(1);
  });

  it("does not let a late client cancel overwrite masseur cancelledBy", async () => {
    const id = await bookAsClient(base);

    const masseurRes = await masseurResolve(
      post("/api/masseur/bookings/resolve", {
        slotStart: base.toISOString(),
        availability: "unavailable",
      }),
    );
    expect(masseurRes?.status).toBe(200);

    const clientRes = await clientCancel(
      post("/api/bookings/cancel", {
        bookingId: id,
        cancelReason: "changed_mind",
      }),
    );
    expect(clientRes.status).toBe(200);

    const booking = await prisma.booking.findUniqueOrThrow({ where: { id } });
    expect(booking.status).toBe("cancelled");
    expect(booking.cancelledBy).toBe("masseur");
    expect(booking.cancelReason).toBeNull();
    expect(notifyMasseurMock).toHaveBeenCalledTimes(1);
    expect(notifyClientMock).toHaveBeenCalledTimes(0);
  });
});
