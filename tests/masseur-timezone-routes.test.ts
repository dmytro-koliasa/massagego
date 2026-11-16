/**
 * Integration test: needs a real Postgres with all migrations applied.
 * Uses TEST_DATABASE_URL like booking-concurrency.test.ts; skipped without it.
 * The server time zone is forced to UTC so that server-local code would fail.
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

describeDb("masseur time zone in availability routes (database)", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let availabilityPost: typeof import("@/app/api/masseur/availability/route").POST;
  let availabilityPut: typeof import("@/app/api/masseur/availability/route").PUT;
  let kyivMasseurId: string;
  let newYorkMasseurId: string;

  const utc = (iso: string) => new Date(`${iso}Z`);

  function request(method: "POST" | "PUT", body: unknown) {
    return new Request("http://test/api/masseur/availability", {
      method,
      body: JSON.stringify(body),
    });
  }

  function ensure(response: Response | undefined) {
    if (!response) throw new Error("availability route returned no response");
    return response;
  }

  async function toggle(start: Date) {
    const response = ensure(
      await availabilityPost(request("POST", { start: start.toISOString() })),
    );
    return { status: response.status, body: await response.json() };
  }

  async function slotStarts(masseurId: string) {
    const slots = await prisma.availabilitySlot.findMany({
      where: { masseurId },
      orderBy: { start: "asc" },
      select: { start: true },
    });
    return slots.map((slot) => slot.start.toISOString());
  }

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    ({ POST: availabilityPost, PUT: availabilityPut } = await import(
      "@/app/api/masseur/availability/route"
    ));

    const kyiv = await prisma.user.create({
      data: { email: "tz-kyiv@test.local", portal: "masseur" },
    });
    const newYork = await prisma.user.create({
      data: {
        email: "tz-new-york@test.local",
        portal: "masseur",
        timezone: "America/New_York",
      },
    });
    kyivMasseurId = kyiv.id;
    newYorkMasseurId = newYork.id;
  });

  beforeEach(async () => {
    session.masseurId = kyivMasseurId;
    await prisma.availabilitySlot.deleteMany({
      where: { masseurId: { in: [kyivMasseurId, newYorkMasseurId] } },
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

  it("gives new masseurs the default Europe/Kyiv time zone", async () => {
    const masseur = await prisma.user.findUniqueOrThrow({ where: { id: kyivMasseurId } });
    expect(masseur.timezone).toBe("Europe/Kyiv");
  });

  it("evaluates the 05:00-23:00 window in the masseur's zone, not the server's", async () => {
    // Summer in Kyiv is UTC+3: 05:00 local = 02:00 UTC, 23:00 local = 20:00 UTC.
    expect((await toggle(utc("2031-07-15T02:00:00"))).status).toBe(200);
    expect((await toggle(utc("2031-07-15T19:00:00"))).status).toBe(200);

    const early = await toggle(utc("2031-07-15T01:00:00"));
    expect(early.status).toBe(400);
    expect(early.body.error).toBe("out_of_hours");

    const late = await toggle(utc("2031-07-15T20:00:00"));
    expect(late.status).toBe(400);
    expect(late.body.error).toBe("out_of_hours");
  });

  it("uses each masseur's own zone", async () => {
    session.masseurId = newYorkMasseurId;
    // 05:00 in New York in July (UTC-4) is 09:00 UTC; 04:00 is out of hours.
    expect((await toggle(utc("2031-07-15T09:00:00"))).status).toBe(200);
    expect((await toggle(utc("2031-07-15T08:00:00"))).status).toBe(400);
  });

  it("copies a week across the spring DST change keeping local hours", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(utc("2027-03-23T09:00:00"));

    // Week of Monday 2027-03-22 in Kyiv (UTC+2), slot Monday 10:00 local.
    await prisma.availabilitySlot.create({
      data: {
        masseurId: kyivMasseurId,
        start: utc("2027-03-22T08:00:00"),
        end: utc("2027-03-22T09:00:00"),
      },
    });

    const response = ensure(
      await availabilityPut(
        request("PUT", {
          from: utc("2027-03-21T22:00:00").toISOString(),
          to: utc("2027-03-28T21:00:00").toISOString(),
          weeksAhead: 2,
        }),
      ),
    );
    expect(response.status).toBe(200);

    // After 2027-03-28 Kyiv is UTC+3, so 10:00 local is 07:00 UTC.
    expect(await slotStarts(kyivMasseurId)).toEqual([
      "2027-03-22T08:00:00.000Z",
      "2027-03-29T07:00:00.000Z",
      "2027-04-05T07:00:00.000Z",
    ]);
  });

  it("copies a week across the autumn DST change keeping local hours", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(utc("2027-10-26T09:00:00"));

    // Week of Monday 2027-10-25 in Kyiv (UTC+3), slot Monday 10:00 local.
    await prisma.availabilitySlot.create({
      data: {
        masseurId: kyivMasseurId,
        start: utc("2027-10-25T07:00:00"),
        end: utc("2027-10-25T08:00:00"),
      },
    });

    const response = ensure(
      await availabilityPut(
        request("PUT", {
          from: utc("2027-10-24T21:00:00").toISOString(),
          to: utc("2027-10-31T22:00:00").toISOString(),
          weeksAhead: 1,
        }),
      ),
    );
    expect(response.status).toBe(200);

    // After 2027-10-31 Kyiv is UTC+2, so 10:00 local is 08:00 UTC.
    expect(await slotStarts(kyivMasseurId)).toEqual([
      "2027-10-25T07:00:00.000Z",
      "2027-11-01T08:00:00.000Z",
    ]);
  });
});
