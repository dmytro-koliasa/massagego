/**
 * Integration smoke: needs TEST_DATABASE_URL with migrations applied.
 * Skipped when the URL is unset so unit-only runs stay green.
 */
import { afterAll, describe, expect, it } from "vitest";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
}

const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

describeDb("database smoke", () => {
  let prisma: typeof import("@/lib/prisma").prisma;

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  it("connects and answers SELECT 1", async () => {
    ({ prisma } = await import("@/lib/prisma"));
    const rows = await prisma.$queryRawUnsafe<Array<{ ok: number }>>(
      "SELECT 1::int AS ok",
    );
    expect(rows[0]?.ok).toBe(1);
  });
});
