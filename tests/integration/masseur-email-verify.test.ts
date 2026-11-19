/**
 * #78 — masseur email verification gates catalog listing; login stays open.
 */
import { createHash, randomBytes } from "crypto";
import { hash } from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  isMasseurListed,
  listedMasseurWhere,
} from "@/lib/masseur-catalog";
import { completeMasseurData } from "./fixtures";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
}

const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

describeDb("masseur email verification", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let consumeVerificationToken: typeof import("@/lib/email/verification").consumeVerificationToken;

  let userId = "";
  const rawToken = randomBytes(32).toString("hex");

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    ({ consumeVerificationToken } = await import("@/lib/email/verification"));

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const passwordHash = await hash("MasseurVerify1!", 12);
    const user = await prisma.user.create({
      data: completeMasseurData({
        email: `masseur-verify-${suffix}@test.local`,
        phone: `+38067${String(Date.now()).slice(-7)}`,
        passwordHash,
        emailVerified: null,
        nameEn: "Verify Masseur",
        nameUk: "Верифікація",
        cityPlaceId: "verify-place",
        address: "1 Verify St",
      }),
    });
    userId = user.id;

    await prisma.availabilitySlot.create({
      data: {
        masseurId: userId,
        start: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
      },
    });

    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    await prisma.verificationToken.create({
      data: {
        identifier: `email-verify:${userId}`,
        token: tokenHash,
        expires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    if (userId) {
      await prisma.verificationToken.deleteMany({
        where: { identifier: `email-verify:${userId}` },
      });
      await prisma.availabilitySlot.deleteMany({ where: { masseurId: userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await prisma.$disconnect();
  });

  it("keeps unverified masseurs out of the catalog until the token is consumed", async () => {
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        nameEn: true,
        nameUk: true,
        cityPlaceId: true,
        address: true,
        phone: true,
        emailVerified: true,
        _count: { select: { availabilitySlots: true } },
      },
    });

    expect(isMasseurListed(before)).toBe(false);
    expect(
      await prisma.user.count({
        where: { AND: [listedMasseurWhere, { id: userId }] },
      }),
    ).toBe(0);

    const consumed = await consumeVerificationToken(rawToken);
    expect(consumed).toEqual({ ok: true, userId });

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        nameEn: true,
        nameUk: true,
        cityPlaceId: true,
        address: true,
        phone: true,
        emailVerified: true,
        _count: { select: { availabilitySlots: true } },
      },
    });
    expect(after.emailVerified).toBeInstanceOf(Date);
    expect(isMasseurListed(after)).toBe(true);
    expect(
      await prisma.user.count({
        where: { AND: [listedMasseurWhere, { id: userId }] },
      }),
    ).toBe(1);

    expect(await consumeVerificationToken(rawToken)).toEqual({
      ok: false,
      error: "invalid_token",
    });
  });
});
