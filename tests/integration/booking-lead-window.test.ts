/**
 * Integration test: needs TEST_DATABASE_URL with migrations applied.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import "./mock-rate-limit";
import {
  completeClientData,
  completeMasseurData,
} from "./fixtures";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
}
const originalTz = process.env.TZ;
process.env.TZ = "UTC";

const session = vi.hoisted(() => ({ clientId: "", masseurId: "" }));

vi.mock("@/lib/client-session.server", () => ({
  requireClientSession: async () => ({ ok: true, userId: session.clientId }),
}));
vi.mock("@/auth/masseur", () => ({
  auth: async () => ({ user: { id: session.masseurId } }),
}));

const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

describeDb("booking lead time and 120-day window (database)", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let clientPost: typeof import("@/app/api/bookings/route").POST;
  let clientAvailabilityGet: typeof import("@/app/api/masseurs/[id]/availability/route").GET;
  let settingsPatch: typeof import("@/app/api/masseur/booking-settings/route").PATCH;
  let masseurId: string;

  const utc = (iso: string) => new Date(`${iso}Z`);
  const HOUR = 60 * 60 * 1000;

  function ensure(response: Response | undefined) {
    if (!response) throw new Error("route returned no response");
    return response;
  }

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    ({ POST: clientPost } = await import("@/app/api/bookings/route"));
    ({ GET: clientAvailabilityGet } = await import(
      "@/app/api/masseurs/[id]/availability/route"
    ));
    ({ PATCH: settingsPatch } = await import(
      "@/app/api/masseur/booking-settings/route"
    ));

    const masseur = await prisma.user.create({
      data: completeMasseurData({
        email: "lead-window-masseur@test.local",
        timezone: "Europe/Kyiv",
        bookingLeadHours: 1,
        cancelCutoffHours: 24,
      }),
    });
    const client = await prisma.user.create({
      data: completeClientData({
        email: "lead-window-client@test.local",
        name: "Lead Client",
        phone: "+380501234567",
      }),
    });
    masseurId = masseur.id;
    session.masseurId = masseur.id;
    session.clientId = client.id;
  });

  beforeEach(async () => {
    session.masseurId = masseurId;
    await prisma.booking.deleteMany({ where: { masseurId } });
    await prisma.availabilitySlot.deleteMany({ where: { masseurId } });
    await prisma.user.update({
      where: { id: masseurId },
      data: { bookingLeadHours: 1, cancelCutoffHours: 24 },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    process.env.TZ = originalTz;
    if (!prisma) return;
    await prisma.user.deleteMany({
      where: { email: { endsWith: "@test.local" } },
    });
    await prisma.$disconnect();
  });

  it("rejects a client booking inside the lead time and accepts just before", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // 10:00 Kyiv summer = 07:00 UTC; lead 1 h → hidden from 06:00 UTC.
    const slot = utc("2031-07-15T07:00:00");
    await prisma.availabilitySlot.create({
      data: { masseurId, start: slot, end: new Date(slot.getTime() + HOUR) },
    });

    vi.setSystemTime(utc("2031-07-15T06:00:00"));
    const tooLate = ensure(
      await clientPost(
        new Request("http://test/api/bookings", {
          method: "POST",
          body: JSON.stringify({
            masseurId,
            slotStarts: [slot.toISOString()],
          }),
        }),
      ),
    );
    expect(tooLate.status).toBe(409);
    expect((await tooLate.json()).error).toBe("BOOKING_LEAD_TIME");

    vi.setSystemTime(utc("2031-07-15T05:59:59"));
    const ok = ensure(
      await clientPost(
        new Request("http://test/api/bookings", {
          method: "POST",
          body: JSON.stringify({
            masseurId,
            slotStarts: [slot.toISOString()],
          }),
        }),
      ),
    );
    expect(ok.status).toBe(201);
  });

  it("hides lead-time slots from client availability", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(utc("2031-07-15T06:00:00"));
    const hidden = utc("2031-07-15T07:00:00");
    const visible = utc("2031-07-15T09:00:00");
    await prisma.availabilitySlot.createMany({
      data: [
        { masseurId, start: hidden, end: new Date(hidden.getTime() + HOUR) },
        { masseurId, start: visible, end: new Date(visible.getTime() + HOUR) },
      ],
    });

    const response = ensure(
      await clientAvailabilityGet(
        new Request(
          `http://test/api/masseurs/${masseurId}/availability?from=${encodeURIComponent(utc("2031-07-15T00:00:00").toISOString())}&to=${encodeURIComponent(utc("2031-07-16T00:00:00").toISOString())}`,
        ),
        { params: Promise.resolve({ id: masseurId }) },
      ),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    const starts = (body.slots as Array<{ start: string }>).map((s) => s.start);
    expect(starts).not.toContain(hidden.toISOString());
    expect(starts).toContain(visible.toISOString());
  });

  it("rejects a client booking beyond the 120-day window", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(utc("2031-01-10T12:00:00"));
    // 2031-01-10 + 121 days local → beyond window.
    const beyond = utc("2031-05-11T07:00:00");
    await prisma.availabilitySlot.create({
      data: {
        masseurId,
        start: beyond,
        end: new Date(beyond.getTime() + HOUR),
      },
    });

    const response = ensure(
      await clientPost(
        new Request("http://test/api/bookings", {
          method: "POST",
          body: JSON.stringify({
            masseurId,
            slotStarts: [beyond.toISOString()],
          }),
        }),
      ),
    );
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("BOOKING_WINDOW_EXCEEDED");
  });

  it("raises cutoff when lead is saved above it", async () => {
    const response = ensure(
      await settingsPatch(
        new Request("http://test/api/masseur/booking-settings", {
          method: "PATCH",
          body: JSON.stringify({
            bookingLeadHours: 4,
            cancelCutoffHours: 2,
          }),
        }),
      ),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.cutoffRaised).toBe(true);
    expect(body.settings).toEqual({
      bookingLeadHours: 4,
      cancelCutoffHours: 4,
    });
  });

  it("refuses cutoff below lead when lead is unchanged", async () => {
    await prisma.user.update({
      where: { id: masseurId },
      data: { bookingLeadHours: 2, cancelCutoffHours: 24 },
    });
    const refused = ensure(
      await settingsPatch(
        new Request("http://test/api/masseur/booking-settings", {
          method: "PATCH",
          body: JSON.stringify({
            bookingLeadHours: 2,
            cancelCutoffHours: 1,
          }),
        }),
      ),
    );
    expect(refused.status).toBe(400);
    expect((await refused.json()).error).toBe("CUTOFF_TOO_LOW");
  });
});
