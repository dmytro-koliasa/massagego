/**
 * Integration test: needs a real Postgres with all migrations applied.
 * Set TEST_DATABASE_URL to a database dedicated to tests (its bookings are
 * written and deleted). Without it the suite is skipped, so the dev/prod
 * DATABASE_URL is never touched.
 *
 *   createdb massage_test
 *   DATABASE_URL=<.../massage_test> npx prisma migrate deploy
 *   TEST_DATABASE_URL=<.../massage_test> npm test
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

describeDb("booking conflicts (database)", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let clientPost: typeof import("@/app/api/bookings/route").POST;
  let masseurPost: typeof import("@/app/api/masseur/bookings/route").POST;
  let masseurId: string;
  let clientIds: string[];

  const HOUR = 60 * 60 * 1000;
  // Far-future, hour-aligned base so slots are never "expired".
  const base = new Date("2031-06-10T10:00:00.000Z");
  const at = (offsetMs: number) => new Date(base.getTime() + offsetMs);

  function clientRequest(starts: Date[]) {
    return new Request("http://test/api/bookings", {
      method: "POST",
      body: JSON.stringify({
        masseurId,
        clientName: "Test Client",
        clientPhone: "+380501234567",
        slotStarts: starts.map((d) => d.toISOString()),
      }),
    });
  }

  function masseurRequest(start: Date) {
    return new Request("http://test/api/masseur/bookings", {
      method: "POST",
      body: JSON.stringify({
        clientName: "Walk-in",
        clientPhone: "+380501234567",
        slotStart: start.toISOString(),
      }),
    });
  }

  async function callMasseur(start: Date) {
    const response = await masseurPost(masseurRequest(start));
    if (!response) throw new Error("masseur route returned no response");
    return response;
  }

  async function openSlots(...starts: Date[]) {
    await prisma.availabilitySlot.createMany({
      data: starts.map((start) => ({
        masseurId,
        start,
        end: new Date(start.getTime() + HOUR),
      })),
    });
  }

  const activeCount = () =>
    prisma.booking.count({ where: { masseurId, status: { not: "cancelled" } } });

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    ({ POST: clientPost } = await import("@/app/api/bookings/route"));
    ({ POST: masseurPost } = await import("@/app/api/masseur/bookings/route"));

    const masseur = await prisma.user.create({
      data: { email: "conc-masseur@test.local", portal: "masseur" },
    });
    masseurId = masseur.id;
    session.masseurId = masseur.id;

    const clients = await Promise.all(
      Array.from({ length: 2 }, (_, i) =>
        prisma.user.create({
          data: { email: `conc-client-${i}@test.local`, portal: "client" },
        }),
      ),
    );
    clientIds = clients.map((c) => c.id);
    session.clientId = clientIds[0];
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

  it("lets exactly one of many concurrent requests book the same slot", async () => {
    await openSlots(base);

    const responses = await Promise.all(
      Array.from({ length: 12 }, () => clientPost(clientRequest([base]))),
    );
    const statuses = responses.map((r) => r.status);
    const failures = await Promise.all(
      responses.filter((r) => r.status !== 201).map((r) => r.json()),
    );

    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(11);
    expect(failures.every((b) => b.error === "slot_taken")).toBe(true);
    expect(await activeCount()).toBe(1);
  });

  it("serialises masseur walk-ins against client bookings for the same hour", async () => {
    await openSlots(base);

    const responses = await Promise.all([
      ...Array.from({ length: 4 }, () => clientPost(clientRequest([base]))),
      ...Array.from({ length: 4 }, () => callMasseur(base)),
    ]);
    const statuses = responses.map((r) => r.status);

    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(7);
    expect(await activeCount()).toBe(1);
  });

  it("never leaves a partial multi-slot booking after losing a race", async () => {
    const second = at(HOUR);
    await openSlots(base, second);

    const [multi, single] = await Promise.all([
      clientPost(clientRequest([base, second])),
      clientPost(clientRequest([second])),
    ]);

    expect([multi.status, single.status].filter((s) => s === 201)).toHaveLength(1);
    // Multi wins both hours, or single wins one and multi rolls back entirely.
    expect(await activeCount()).toBe(multi.status === 201 ? 2 : 1);
  });

  it("rejects overlapping bookings that start at different times", async () => {
    await prisma.booking.create({
      data: { masseurId, clientName: "a", clientPhone: "1", slotStart: base },
    });

    await expect(
      prisma.booking.create({
        data: {
          masseurId,
          clientName: "b",
          clientPhone: "2",
          slotStart: at(30 * 60 * 1000),
        },
      }),
    ).rejects.toThrow(/Booking_no_overlapping_active_slots/);

    // Adjacent hours do not overlap.
    await expect(
      prisma.booking.create({
        data: { masseurId, clientName: "c", clientPhone: "3", slotStart: at(HOUR) },
      }),
    ).resolves.toBeTruthy();
  });

  it("allows rebooking a slot after the booking was cancelled", async () => {
    await openSlots(base);

    const first = await clientPost(clientRequest([base]));
    expect(first.status).toBe(201);
    const { bookings } = await first.json();

    await prisma.booking.update({
      where: { id: bookings[0].id },
      data: { status: "cancelled" },
    });

    session.clientId = clientIds[1];
    const again = await clientPost(clientRequest([base]));
    session.clientId = clientIds[0];

    expect(again.status).toBe(201);
    expect(await activeCount()).toBe(1);
    expect(
      await prisma.booking.count({ where: { masseurId, status: "cancelled" } }),
    ).toBe(1);
  });

  it("does not conflict across different masseurs", async () => {
    const other = await prisma.user.create({
      data: { email: "conc-other-masseur@test.local", portal: "masseur" },
    });
    await prisma.booking.create({
      data: { masseurId, clientName: "a", clientPhone: "1", slotStart: base },
    });
    await expect(
      prisma.booking.create({
        data: {
          masseurId: other.id,
          clientName: "b",
          clientPhone: "2",
          slotStart: base,
        },
      }),
    ).resolves.toBeTruthy();
  });
});
