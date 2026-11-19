/**
 * #79 — password reset bumps passwordChangedAt so pre-reset JWTs become stale.
 */
import { randomBytes } from "crypto";
import { hash } from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyPasswordVersionToJwt } from "@/lib/auth/password-credential-version";
import { completeMasseurData } from "./fixtures";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
}

const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

describeDb("password reset JWT invalidation", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let consumeResetToken: typeof import("@/lib/email/password-reset").consumeResetToken;
  let hashPasswordResetToken: typeof import("@/lib/email/password-reset").hashPasswordResetToken;

  let userId = "";
  const rawToken = randomBytes(32).toString("hex");

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    ({ consumeResetToken, hashPasswordResetToken } = await import(
      "@/lib/email/password-reset"
    ));

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const passwordHash = await hash("OldPassword1!", 12);
    const user = await prisma.user.create({
      data: completeMasseurData({
        email: `reset-jwt-${suffix}@test.local`,
        phone: `+38050${String(Date.now()).slice(-7)}`,
        passwordHash,
        emailVerified: new Date("2030-01-01T00:00:00.000Z"),
        passwordChangedAt: null,
      }),
    });
    userId = user.id;

    const tokenHash = hashPasswordResetToken(rawToken);
    await prisma.verificationToken.create({
      data: {
        identifier: `password-reset:${userId}`,
        token: tokenHash,
        expires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    if (userId) {
      await prisma.verificationToken.deleteMany({
        where: { identifier: `password-reset:${userId}` },
      });
      await prisma.session.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await prisma.$disconnect();
  });

  it("bumps passwordChangedAt and makes a pre-reset JWT stamp stale", async () => {
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordChangedAt: true, passwordHash: true },
    });
    expect(before.passwordChangedAt).toBeNull();

    // Simulate a JWT issued while passwordChangedAt was still null.
    const preResetToken = { pwdChangedAt: 0 };
    expect(
      applyPasswordVersionToJwt({
        token: preResetToken,
        dbPasswordChangedAt: before.passwordChangedAt,
        isInitialSignIn: false,
      }),
    ).toBe("ok");

    const result = await consumeResetToken({
      rawToken,
      password: "NewPassword1!",
      passwordConfirm: "NewPassword1!",
    });
    expect(result).toEqual({ ok: true, userId });

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordChangedAt: true, passwordHash: true },
    });
    expect(after.passwordChangedAt).toBeInstanceOf(Date);
    expect(after.passwordHash).not.toBe(before.passwordHash);

    expect(
      applyPasswordVersionToJwt({
        token: preResetToken,
        dbPasswordChangedAt: after.passwordChangedAt,
        isInitialSignIn: false,
      }),
    ).toBe("stale");

    // Fresh sign-in after reset stamps the new version and is accepted.
    const postResetToken: { pwdChangedAt?: number } = {};
    expect(
      applyPasswordVersionToJwt({
        token: postResetToken,
        dbPasswordChangedAt: after.passwordChangedAt,
        isInitialSignIn: true,
      }),
    ).toBe("ok");
    expect(postResetToken.pwdChangedAt).toBe(after.passwordChangedAt!.getTime());
    expect(
      applyPasswordVersionToJwt({
        token: postResetToken,
        dbPasswordChangedAt: after.passwordChangedAt,
        isInitialSignIn: false,
      }),
    ).toBe("ok");

    // Token is one-time.
    const reuse = await consumeResetToken({
      rawToken,
      password: "AnotherPassword1!",
      passwordConfirm: "AnotherPassword1!",
    });
    expect(reuse).toEqual({ ok: false, error: "invalid_token" });
  });
});
