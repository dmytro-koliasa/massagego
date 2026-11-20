/**
 * #135 — changing masseur phone clears phoneConfirmedAt; same E.164 keeps it.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { completeMasseurData } from "./fixtures";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
}

const session = vi.hoisted(() => ({ masseurId: "" }));

vi.mock("@/auth/masseur", () => ({
  auth: async () => ({ user: { id: session.masseurId } }),
}));

const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

describeDb("masseur profile phone confirmation (#135)", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let patchProfile: typeof import("@/app/api/masseur/profile/route").PATCH;
  let masseurId = "";

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    ({ PATCH: patchProfile } = await import("@/app/api/masseur/profile/route"));

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const masseur = await prisma.user.create({
      data: {
        ...completeMasseurData({
          email: `phone-confirm-${suffix}@test.local`,
          phone: "+380501112233",
        }),
        phoneConfirmedAt: new Date("2030-01-01T00:00:00.000Z"),
        emailVerified: new Date("2030-01-01T00:00:00.000Z"),
      },
    });
    masseurId = masseur.id;
    session.masseurId = masseur.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    if (masseurId) {
      await prisma.user.deleteMany({ where: { id: masseurId } });
    }
    await prisma.$disconnect();
  });

  it("keeps phoneConfirmedAt when the E.164 phone is unchanged", async () => {
    const response = await patchProfile(
      new Request("http://test/api/masseur/profile", {
        method: "PATCH",
        body: JSON.stringify({
          nameEn: "Phone Keep",
          nameUk: "Phone Keep",
          city: {
            placeId: "place-1",
            countryCode: "UA",
            nameEn: "Kyiv",
            nameUk: "Київ",
            lat: 50.45,
            lon: 30.52,
          },
          address: "Khreshchatyk 1",
          phone: "+380501112233",
          timezone: "Europe/Kyiv",
        }),
      }),
    );
    expect(response.status).toBe(200);
    const row = await prisma.user.findUniqueOrThrow({
      where: { id: masseurId },
      select: { phoneConfirmedAt: true },
    });
    expect(row.phoneConfirmedAt).toEqual(new Date("2030-01-01T00:00:00.000Z"));
  });

  it("clears phoneConfirmedAt when the phone number changes", async () => {
    const response = await patchProfile(
      new Request("http://test/api/masseur/profile", {
        method: "PATCH",
        body: JSON.stringify({
          nameEn: "Phone Change",
          nameUk: "Phone Change",
          city: {
            placeId: "place-1",
            countryCode: "UA",
            nameEn: "Kyiv",
            nameUk: "Київ",
            lat: 50.45,
            lon: 30.52,
          },
          address: "Khreshchatyk 1",
          phone: "+380671112233",
          timezone: "Europe/Kyiv",
        }),
      }),
    );
    expect(response.status).toBe(200);
    const row = await prisma.user.findUniqueOrThrow({
      where: { id: masseurId },
      select: { phone: true, phoneConfirmedAt: true },
    });
    expect(row.phone).toBe("+380671112233");
    expect(row.phoneConfirmedAt).toBeNull();
  });
});
