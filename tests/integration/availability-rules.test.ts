/**
 * Integration test: needs TEST_DATABASE_URL. Server TZ forced to UTC.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
}
const originalTz = process.env.TZ;
process.env.TZ = "UTC";

const session = vi.hoisted(() => ({ masseurId: "" }));

vi.mock("@/auth/masseur", () => ({
  auth: async () => ({ user: { id: session.masseurId } }),
}));

const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

describeDb("availability rules (database)", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let availabilityPost: typeof import("@/app/api/masseur/availability/route").POST;
  let availabilityPut: typeof import("@/app/api/masseur/availability/route").PUT;
  let masseurPost: typeof import("@/app/api/masseur/bookings/route").POST;
  let masseurId: string;

  const utc = (iso: string) => new Date(`${iso}Z`);

  function request(method: "POST" | "PUT", body: unknown, url = "/api/masseur/availability") {
    return new Request(`http://test${url}`, {
      method,
      body: JSON.stringify(body),
    });
  }

  function ensure(response: Response | undefined) {
    if (!response) throw new Error("route returned no response");
    return response;
  }

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    ({ POST: availabilityPost, PUT: availabilityPut } = await import(
      "@/app/api/masseur/availability/route"
    ));
    ({ POST: masseurPost } = await import("@/app/api/masseur/bookings/route"));

    const masseur = await prisma.user.create({
      data: { email: "avail-rules@test.local", portal: "masseur" },
    });
    masseurId = masseur.id;
    session.masseurId = masseur.id;
  });

  beforeEach(async () => {
    session.masseurId = masseurId;
    await prisma.booking.deleteMany({ where: { masseurId } });
    await prisma.availabilitySlot.deleteMany({ where: { masseurId } });
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

  it("rejects adding or removing a started availability slot", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(utc("2031-07-15T10:30:00"));

    // 10:00 Kyiv summer = 07:00 UTC; the hour has started.
    const started = utc("2031-07-15T07:00:00");
    await prisma.availabilitySlot.create({
      data: {
        masseurId,
        start: started,
        end: utc("2031-07-15T08:00:00"),
      },
    });

    const remove = ensure(
      await availabilityPost(
        request("POST", { start: started.toISOString(), active: false }),
      ),
    );
    expect(remove.status).toBe(409);
    expect((await remove.json()).error).toBe("slot_in_past");

    const add = ensure(
      await availabilityPost(
        request("POST", {
          start: utc("2031-07-15T08:00:00").toISOString(),
          active: true,
        }),
      ),
    );
    // 11:00 Kyiv = 08:00 UTC; also started at 10:30.
    expect(add.status).toBe(409);
    expect((await add.json()).error).toBe("slot_in_past");
  });

  it("rejects a walk-in outside 05:00-23:00 with out_of_hours", async () => {
    // 04:00 Kyiv summer = 01:00 UTC.
    const response = ensure(
      await masseurPost(
        request(
          "POST",
          {
            clientName: "Walk-in",
            clientPhone: "+380501234567",
            slotStart: utc("2031-07-15T01:00:00").toISOString(),
          },
          "/api/masseur/bookings",
        ),
      ),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("out_of_hours");
    expect(await prisma.booking.count({ where: { masseurId } })).toBe(0);
    expect(await prisma.availabilitySlot.count({ where: { masseurId } })).toBe(0);
  });

  it("rejects weekly copy when the template has an out-of-hours slot", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(utc("2031-07-14T09:00:00"));

    // Current week Mon 2031-07-14 00:00 Kyiv (UTC+3) → next Mon.
    const from = utc("2031-07-13T21:00:00");
    const to = utc("2031-07-20T21:00:00");
    // 03:00 Kyiv = 00:00 UTC — outside the window.
    const bad = utc("2031-07-14T00:00:00");

    const response = ensure(
      await availabilityPut(
        request("PUT", {
          from: from.toISOString(),
          to: to.toISOString(),
          weeksAhead: 1,
          template: [bad.toISOString()],
        }),
      ),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("out_of_hours");
    expect(await prisma.availabilitySlot.count({ where: { masseurId } })).toBe(0);
  });

  it("does not delete future slots when the weekly-copy template is duplicate (#129)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(utc("2031-07-14T09:00:00"));

    const from = utc("2031-07-13T21:00:00");
    const to = utc("2031-07-20T21:00:00");
    const templateStart = utc("2031-07-14T07:00:00"); // 10:00 Kyiv
    const existingFuture = utc("2031-07-21T07:00:00"); // next week copy target

    await prisma.availabilitySlot.create({
      data: {
        masseurId,
        start: existingFuture,
        end: utc("2031-07-21T08:00:00"),
      },
    });

    const response = ensure(
      await availabilityPut(
        request("PUT", {
          from: from.toISOString(),
          to: to.toISOString(),
          weeksAhead: 1,
          template: [templateStart.toISOString(), templateStart.toISOString()],
        }),
      ),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("duplicate_template");
    expect(
      await prisma.availabilitySlot.count({
        where: { masseurId, start: existingFuture },
      }),
    ).toBe(1);
  });

  it("rejects weekly copy when a generated start is already started (#129)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(utc("2031-07-14T09:00:00"));

    const from = utc("2031-07-13T21:00:00");
    const to = utc("2031-07-20T21:00:00");
    // Template two weeks ago Monday 10:00 Kyiv → +1 week is still before `now`.
    const staleTemplate = utc("2031-06-30T07:00:00");
    const existingFuture = utc("2031-07-21T07:00:00");

    await prisma.availabilitySlot.create({
      data: {
        masseurId,
        start: existingFuture,
        end: utc("2031-07-21T08:00:00"),
      },
    });

    const response = ensure(
      await availabilityPut(
        request("PUT", {
          from: from.toISOString(),
          to: to.toISOString(),
          weeksAhead: 1,
          template: [staleTemplate.toISOString()],
        }),
      ),
    );
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("slot_in_past");
    expect(
      await prisma.availabilitySlot.count({
        where: { masseurId, start: existingFuture },
      }),
    ).toBe(1);
  });

  it("keeps booked hours in the target window when weekly copy succeeds (#129)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(utc("2031-07-14T09:00:00"));

    const from = utc("2031-07-13T21:00:00");
    const to = utc("2031-07-20T21:00:00");
    const templateStart = utc("2031-07-14T07:00:00"); // 10:00 Kyiv
    const bookedStart = utc("2031-07-21T07:00:00"); // same hour next week
    const otherFuture = utc("2031-07-22T07:00:00");

    await prisma.availabilitySlot.createMany({
      data: [
        {
          masseurId,
          start: bookedStart,
          end: utc("2031-07-21T08:00:00"),
        },
        {
          masseurId,
          start: otherFuture,
          end: utc("2031-07-22T08:00:00"),
        },
      ],
    });
    await prisma.booking.create({
      data: {
        masseurId,
        clientName: "Booked",
        clientPhone: "+380501111111",
        slotStart: bookedStart,
        status: "confirmed",
        massageType: "classic",
      },
    });

    const response = ensure(
      await availabilityPut(
        request("PUT", {
          from: from.toISOString(),
          to: to.toISOString(),
          weeksAhead: 1,
          template: [templateStart.toISOString()],
        }),
      ),
    );
    expect(response.status).toBe(200);
    expect(
      await prisma.availabilitySlot.count({
        where: { masseurId, start: bookedStart },
      }),
    ).toBe(1);
    // Unbooked prior future hour is replaced by the template copy (same start).
    expect(
      await prisma.availabilitySlot.count({
        where: { masseurId, start: otherFuture },
      }),
    ).toBe(0);
    expect(
      await prisma.availabilitySlot.count({
        where: { masseurId, start: bookedStart },
      }),
    ).toBe(1);
  });

  it("still allows a walk-in inside the window before the slot starts", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(utc("2031-07-15T06:00:00")); // 09:00 Kyiv

    const response = ensure(
      await masseurPost(
        request(
          "POST",
          {
            clientName: "Walk-in",
            clientPhone: "+380501234567",
            slotStart: utc("2031-07-15T07:00:00").toISOString(), // 10:00 Kyiv
          },
          "/api/masseur/bookings",
        ),
      ),
    );
    expect(response.status).toBe(201);
  });
});
