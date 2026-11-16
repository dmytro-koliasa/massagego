/**
 * Integration test: needs a real Postgres with all migrations applied.
 * Uses TEST_DATABASE_URL like booking-concurrency.test.ts; skipped without it.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
}

const session = vi.hoisted(() => ({ clientId: "", masseurId: "" }));

vi.mock("@/lib/client-session.server", () => ({
  requireClientSession: async () => ({ ok: true, userId: session.clientId }),
}));
vi.mock("@/auth/masseur", () => ({
  auth: async () => ({ user: { id: session.masseurId } }),
}));

const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

describeDb("booking status and cancellation data (database)", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let clientPost: typeof import("@/app/api/bookings/route").POST;
  let clientCancel: typeof import("@/app/api/bookings/cancel/route").POST;
  let masseurPost: typeof import("@/app/api/masseur/bookings/route").POST;
  let masseurResolve: typeof import("@/app/api/masseur/bookings/resolve/route").POST;
  let masseurId: string;

  const HOUR = 60 * 60 * 1000;
  const base = new Date("2031-07-15T10:00:00.000Z");

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
        clientName: "Status Client",
        clientPhone: "+380501234567",
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
    ({ POST: masseurPost } = await import("@/app/api/masseur/bookings/route"));
    ({ POST: masseurResolve } = await import("@/app/api/masseur/bookings/resolve/route"));

    const masseur = await prisma.user.create({
      data: { email: "status-masseur@test.local", portal: "masseur" },
    });
    const client = await prisma.user.create({
      data: { email: "status-client@test.local", portal: "client" },
    });
    masseurId = masseur.id;
    session.masseurId = masseur.id;
    session.clientId = client.id;
  });

  beforeEach(async () => {
    await prisma.booking.deleteMany({ where: { masseurId } });
    await prisma.availabilitySlot.deleteMany({ where: { masseurId } });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.user.deleteMany({
      where: { email: { endsWith: "@test.local" } },
    });
    await prisma.$disconnect();
  });

  it("creates client bookings as confirmed without cancellation data", async () => {
    const id = await bookAsClient(base);
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id } });

    expect(booking.status).toBe("confirmed");
    expect(booking.cancelledBy).toBeNull();
    expect(booking.cancelledAt).toBeNull();
    expect(booking.cancelReason).toBeNull();
    expect(booking.cancelReasonText).toBeNull();
  });

  it("creates masseur walk-in bookings as confirmed", async () => {
    const response = await masseurPost(
      post("/api/masseur/bookings", {
        clientName: "Walk-in",
        clientPhone: "+380501234567",
        slotStart: base.toISOString(),
      }),
    );
    if (!response) throw new Error("masseur route returned no response");
    expect(response.status).toBe(201);
    const { booking } = await response.json();

    const stored = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(stored.status).toBe("confirmed");
    expect(stored.clientUserId).toBeNull();
  });

  it("records cancelledBy client and cancelledAt when the client cancels", async () => {
    const id = await bookAsClient(base);

    const before = Date.now();
    const response = await clientCancel(post("/api/bookings/cancel", { bookingId: id }));
    const after = Date.now();
    expect(response.status).toBe(200);

    const booking = await prisma.booking.findUniqueOrThrow({ where: { id } });
    expect(booking.status).toBe("cancelled");
    expect(booking.cancelledBy).toBe("client");
    expect(booking.cancelledAt!.getTime()).toBeGreaterThanOrEqual(before);
    expect(booking.cancelledAt!.getTime()).toBeLessThanOrEqual(after);
    expect(booking.cancelReason).toBeNull();
  });

  it("records cancelledBy masseur and cancelledAt when the masseur cancels", async () => {
    const id = await bookAsClient(base);

    const before = Date.now();
    const response = await masseurResolve(
      post("/api/masseur/bookings/resolve", {
        slotStart: base.toISOString(),
        availability: "available",
      }),
    );
    const after = Date.now();
    if (!response) throw new Error("resolve route returned no response");
    expect(response.status).toBe(200);

    const booking = await prisma.booking.findUniqueOrThrow({ where: { id } });
    expect(booking.status).toBe("cancelled");
    expect(booking.cancelledBy).toBe("masseur");
    expect(booking.cancelledAt!.getTime()).toBeGreaterThanOrEqual(before);
    expect(booking.cancelledAt!.getTime()).toBeLessThanOrEqual(after);
    expect(booking.cancelReason).toBeNull();

    // The freed hour can be booked again next to the cancelled row.
    const again = await clientPost(
      post("/api/bookings", {
        masseurId,
        clientName: "Status Client",
        clientPhone: "+380501234567",
        slotStarts: [base.toISOString()],
      }),
    );
    expect(again.status).toBe(201);
  });

  it("rejects status values outside the enum", async () => {
    await expect(
      prisma.$executeRaw`
        INSERT INTO "Booking" ("id", "masseurId", "clientName", "clientPhone", "slotStart", "status", "updatedAt")
        VALUES ('status-pending', ${masseurId}, 'a', '1', ${base}, 'pending', now())
      `,
    ).rejects.toThrow(/invalid input value for enum "BookingStatus"/);
  });

  it("limits the Other reason text to 200 characters", async () => {
    const id = await bookAsClient(base);

    await expect(
      prisma.booking.update({
        where: { id },
        data: { cancelReason: "other", cancelReasonText: "x".repeat(200) },
      }),
    ).resolves.toBeTruthy();
    await expect(
      prisma.booking.update({
        where: { id },
        data: { cancelReasonText: "x".repeat(201) },
      }),
    ).rejects.toThrow();
  });

  it("keeps treating every confirmed booking as occupying the hour", async () => {
    await prisma.booking.create({
      data: { masseurId, clientName: "a", clientPhone: "1", slotStart: base },
    });
    await expect(
      prisma.booking.create({
        data: {
          masseurId,
          clientName: "b",
          clientPhone: "2",
          slotStart: new Date(base.getTime() + 30 * 60 * 1000),
        },
      }),
    ).rejects.toThrow(/Booking_no_overlapping_active_slots/);
  });
});
