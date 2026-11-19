/**
 * #87 — availability JSON event ids must not embed raw booking primary keys.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeClientData,
  completeMasseurData,
  slotInsideBookingWindow,
} from "./fixtures";
import {
  eventIdExposesBookingPrimaryKey,
  syntheticBookedSlotEventId,
} from "@/lib/availability-event-id";
import { SLOT_MS } from "@/lib/booking-constants";

function ensure(response: Response | undefined) {
  if (!response) throw new Error("route returned no response");
  return response;
}

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

describeDb("availability event ids (#87)", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let clientAvailabilityGet: typeof import("@/app/api/masseurs/[id]/availability/route").GET;
  let masseurAvailabilityGet: typeof import("@/app/api/masseur/availability/route").GET;

  let masseurId = "";
  let clientId = "";
  let otherClientId = "";
  let bookingId = "";
  let slotStart = new Date();

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    ({ GET: clientAvailabilityGet } = await import(
      "@/app/api/masseurs/[id]/availability/route"
    ));
    ({ GET: masseurAvailabilityGet } = await import(
      "@/app/api/masseur/availability/route"
    ));

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const masseur = await prisma.user.create({
      data: completeMasseurData({
        email: `avail-eid-masseur-${suffix}@test.local`,
        phone: `+38050${String(Date.now()).slice(-7)}`,
      }),
    });
    const client = await prisma.user.create({
      data: completeClientData({
        email: `avail-eid-client-${suffix}@test.local`,
        phone: `+38051${String(Date.now()).slice(-7)}`,
      }),
    });
    const other = await prisma.user.create({
      data: completeClientData({
        email: `avail-eid-other-${suffix}@test.local`,
        phone: `+38052${String(Date.now()).slice(-7)}`,
      }),
    });

    masseurId = masseur.id;
    clientId = client.id;
    otherClientId = other.id;
    session.masseurId = masseurId;
    session.clientId = clientId;
  });

  beforeEach(async () => {
    session.masseurId = masseurId;
    session.clientId = clientId;
    await prisma.booking.deleteMany({ where: { masseurId } });
    await prisma.availabilitySlot.deleteMany({ where: { masseurId } });

    slotStart = slotInsideBookingWindow(14, 10);
    // Separate hour so the masseur stays listed without an availability row
    // on the booked hour (synthetic event-id path).
    const listedSlot = slotInsideBookingWindow(14, 12);
    await prisma.availabilitySlot.create({
      data: {
        masseurId,
        start: listedSlot,
        end: new Date(listedSlot.getTime() + SLOT_MS),
      },
    });
    const booking = await prisma.booking.create({
      data: {
        masseurId,
        clientUserId: otherClientId,
        clientName: "Other",
        clientPhone: "+380521111111",
        slotStart,
        massageType: "classic",
        status: "confirmed",
      },
      select: { id: true },
    });
    bookingId = booking.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.booking.deleteMany({ where: { masseurId } });
    await prisma.availabilitySlot.deleteMany({ where: { masseurId } });
    await prisma.user.deleteMany({
      where: { id: { in: [masseurId, clientId, otherClientId] } },
    });
    await prisma.$disconnect();
  });

  it("client availability uses opaque ids and hides others' bookingId", async () => {
    const from = new Date(slotStart.getTime() - SLOT_MS);
    const to = new Date(slotStart.getTime() + 2 * SLOT_MS);
    const res = ensure(
      await clientAvailabilityGet(
        new Request(
          `http://test/api/masseurs/${masseurId}/availability?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
        ),
        { params: Promise.resolve({ id: masseurId }) },
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      slots: Array<{ id: string; bookingId: string | null; start: string }>;
    };
    const slot = body.slots.find((s) => s.start === slotStart.toISOString());
    expect(slot).toBeTruthy();
    expect(slot!.id).toBe(syntheticBookedSlotEventId(slotStart.toISOString()));
    expect(eventIdExposesBookingPrimaryKey(slot!.id, bookingId)).toBe(false);
    expect(slot!.bookingId).toBeNull();
  });

  it("masseur availability keeps bookingId but uses opaque calendar id", async () => {
    const from = new Date(slotStart.getTime() - SLOT_MS);
    const to = new Date(slotStart.getTime() + 2 * SLOT_MS);
    const res = ensure(
      await masseurAvailabilityGet(
        new Request(
          `http://test/api/masseur/availability?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
        ),
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      slots: Array<{ id: string; bookingId: string | null; start: string }>;
    };
    const slot = body.slots.find((s) => s.start === slotStart.toISOString());
    expect(slot).toBeTruthy();
    expect(slot!.id).toBe(syntheticBookedSlotEventId(slotStart.toISOString()));
    expect(eventIdExposesBookingPrimaryKey(slot!.id, bookingId)).toBe(false);
    expect(slot!.bookingId).toBe(bookingId);
  });
});
