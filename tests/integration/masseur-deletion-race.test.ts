/**
 * #83 — masseur delete vs concurrent client booking cannot leave an active
 * booking on a deleted masseur.
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
vi.mock("@/lib/uploads", () => ({
  deleteUpload: vi.fn(async () => undefined),
}));

const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

describeDb("masseur account deletion race (#83)", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let clientPost: typeof import("@/app/api/bookings/route").POST;
  let deleteOwnAccount: typeof import("@/lib/account-deletion").deleteOwnAccount;
  let masseurId = "";
  let clientId = "";

  const HOUR = 60 * 60 * 1000;
  const base = slotInsideBookingWindow(18, 12);

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
    ({ POST: clientPost } = await import("@/app/api/bookings/route"));
    ({ deleteOwnAccount } = await import("@/lib/account-deletion"));

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const masseur = await prisma.user.create({
      data: completeMasseurData({
        email: `del-race-m-${suffix}@test.local`,
        phone: `+38050${String(Date.now()).slice(-7)}`,
      }),
    });
    const client = await prisma.user.create({
      data: completeClientData({
        email: `del-race-c-${suffix}@test.local`,
        name: "Deletion Race Client",
        phone: `+38067${String(Date.now()).slice(-7)}`,
      }),
    });
    masseurId = masseur.id;
    clientId = client.id;
    session.masseurId = masseur.id;
    session.clientId = client.id;
  });

  beforeEach(async () => {
    await prisma.booking.deleteMany({
      where: { OR: [{ masseurId }, { clientUserId: clientId }] },
    });
    await prisma.availabilitySlot.deleteMany({ where: { masseurId } });
    // Restore after prior delete tests anonymise the row.
    await prisma.user.update({
      where: { id: masseurId },
      data: completeMasseurData({
        email: `del-race-m-${masseurId.slice(-8)}@test.local`,
        phone: `+38050${masseurId.replace(/\D/g, "").slice(-7).padStart(7, "0")}`,
        deletedAt: null,
      }),
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

  it("refuses masseur delete while a future confirmed booking exists", async () => {
    await prisma.availabilitySlot.create({
      data: {
        masseurId,
        start: base,
        end: new Date(base.getTime() + HOUR),
      },
    });
    const bookRes = await clientPost(bookRequest(base));
    expect(bookRes.status).toBe(201);

    const result = await deleteOwnAccount({
      userId: masseurId,
      portal: "masseur",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("masseur_has_future_bookings");
      expect(result.futureBookingCount).toBeGreaterThan(0);
    }

    const masseur = await prisma.user.findUniqueOrThrow({
      where: { id: masseurId },
    });
    expect(masseur.deletedAt).toBeNull();
  });

  it("concurrent book+delete never leaves active booking on deleted masseur", async () => {
    await prisma.availabilitySlot.create({
      data: {
        masseurId,
        start: base,
        end: new Date(base.getTime() + HOUR),
      },
    });

    const [bookRes, deleteResult] = await Promise.all([
      clientPost(bookRequest(base)),
      deleteOwnAccount({ userId: masseurId, portal: "masseur" }),
    ]);

    const masseur = await prisma.user.findUniqueOrThrow({
      where: { id: masseurId },
      select: { deletedAt: true },
    });
    const active = await prisma.booking.count({
      where: {
        masseurId,
        status: "confirmed",
        slotStart: { gt: new Date() },
      },
    });

    // Invariant: deleted masseur cannot own future confirmed bookings.
    if (masseur.deletedAt) {
      expect(active).toBe(0);
      expect(deleteResult.ok).toBe(true);
      // Booking either failed or never committed as confirmed.
      expect([201, 404, 409]).toContain(bookRes.status);
      if (bookRes.status === 201) {
        // If HTTP said created, row must not remain confirmed on deleted masseur.
        expect(active).toBe(0);
      }
    } else {
      // Delete lost / refused — booking may have won.
      expect(deleteResult.ok).toBe(false);
      if (!deleteResult.ok) {
        expect(deleteResult.error).toBe("masseur_has_future_bookings");
      }
      expect(bookRes.status).toBe(201);
      expect(active).toBe(1);
    }
  });

  it("deletes a masseur with no future bookings", async () => {
    const result = await deleteOwnAccount({
      userId: masseurId,
      portal: "masseur",
    });
    expect(result).toEqual({ ok: true });

    const masseur = await prisma.user.findUniqueOrThrow({
      where: { id: masseurId },
    });
    expect(masseur.deletedAt).toBeInstanceOf(Date);
    expect(masseur.email).toBe(`deleted:${masseurId}@invalid.local`);
  });
});
