/**
 * #207 AD-2: shared catalog DAL returns the same shape/semantics for identical
 * actor + query params (RSC seed and API both call queryMasseurCatalog).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  completeClientData,
  completeMasseurData,
  slotInsideBookingWindow,
} from "./fixtures";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
}

const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

describeDb("masseur catalog DAL equivalence (#207)", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let queryMasseurCatalog: typeof import("@/lib/masseur-catalog-query").queryMasseurCatalog;
  let serializeMasseurCatalog: typeof import("@/lib/masseur-catalog-query").serializeMasseurCatalog;

  let clientId = "";
  let masseurId = "";
  let placeId = "";

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    ({ queryMasseurCatalog, serializeMasseurCatalog } = await import(
      "@/lib/masseur-catalog-query"
    ));

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    placeId = `place-catalog-${suffix}`;
    const client = await prisma.user.create({
      data: completeClientData({
        email: `client-catalog-${suffix}@test.local`,
        phone: `+38067${String(Date.now()).slice(-7)}`,
        cityPlaceId: placeId,
      }),
    });
    const masseur = await prisma.user.create({
      data: completeMasseurData({
        email: `masseur-catalog-${suffix}@test.local`,
        phone: `+38050${String(Date.now()).slice(-7)}`,
        cityPlaceId: placeId,
        slug: `catalog-${suffix}`,
      }),
    });
    clientId = client.id;
    masseurId = masseur.id;

    const start = slotInsideBookingWindow(14, 10);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    await prisma.availabilitySlot.create({
      data: {
        masseurId,
        start,
        end,
      },
    });
  });

  afterAll(async () => {
    if (!clientId) return;
    await prisma.availabilitySlot.deleteMany({ where: { masseurId } });
    await prisma.user.deleteMany({
      where: { id: { in: [clientId, masseurId] } },
    });
  });

  it("returns equivalent results for the same authorized query twice", async () => {
    const a = await queryMasseurCatalog({
      clientUserId: clientId,
      city: "all",
      page: 1,
      pageSize: 9,
    });
    const b = await queryMasseurCatalog({
      clientUserId: clientId,
      city: "all",
      page: 1,
      pageSize: 9,
    });

    expect(a.cityFilter).toBe("all");
    expect(a.page).toBe(1);
    expect(a.pageSize).toBe(9);
    expect(a.totalAll).toBeGreaterThanOrEqual(1);
    expect(serializeMasseurCatalog(a)).toEqual(serializeMasseurCatalog(b));
  });

  it("applies default city filter when city omitted", async () => {
    const result = await queryMasseurCatalog({
      clientUserId: clientId,
      page: 1,
    });
    expect(result.cityFilter).toBe(result.defaultCityFilter);
    expect(result.defaultCityFilter).toBe(`id:${placeId}`);
    expect(result.masseurs.some((m) => m.id === masseurId)).toBe(true);
  });

  it("clamps out-of-range page", async () => {
    const result = await queryMasseurCatalog({
      clientUserId: clientId,
      city: "all",
      page: 9999,
      pageSize: 9,
    });
    expect(result.page).toBe(result.totalPages);
    expect(result.page).toBeGreaterThanOrEqual(1);
  });
});
