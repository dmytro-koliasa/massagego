/**
 * #137 — admin password change bumps passwordChangedAt so pre-change JWTs stale.
 */
import { hash } from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyPasswordVersionToJwt } from "@/lib/auth/password-credential-version";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
}

const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

describeDb("admin password change JWT invalidation (#137)", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let changeAdminPassword: typeof import("@/lib/admin-password").changeAdminPassword;
  let adminId = "";

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    ({ changeAdminPassword } = await import("@/lib/admin-password"));

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const passwordHash = await hash("OldAdminPass1!", 12);
    const admin = await prisma.user.create({
      data: {
        email: `admin-pwd-${suffix}@test.local`,
        portal: "admin",
        passwordHash,
        passwordChangedAt: null,
        name: "Admin",
      },
    });
    adminId = admin.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    if (adminId) {
      await prisma.user.deleteMany({ where: { id: adminId } });
    }
    await prisma.$disconnect();
  });

  it("bumps passwordChangedAt and marks a pre-change JWT stamp stale", async () => {
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: adminId },
      select: { passwordChangedAt: true },
    });
    expect(before.passwordChangedAt).toBeNull();

    const preChangeToken = { pwdChangedAt: 0 };
    expect(
      applyPasswordVersionToJwt({
        token: preChangeToken,
        dbPasswordChangedAt: before.passwordChangedAt,
        isInitialSignIn: false,
      }),
    ).toBe("ok");

    const result = await changeAdminPassword({
      adminUserId: adminId,
      currentPassword: "OldAdminPass1!",
      newPassword: "NewAdminPass2!",
    });
    expect(result).toEqual({ ok: true });

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: adminId },
      select: { passwordChangedAt: true },
    });
    expect(after.passwordChangedAt).toBeInstanceOf(Date);

    expect(
      applyPasswordVersionToJwt({
        token: preChangeToken,
        dbPasswordChangedAt: after.passwordChangedAt,
        isInitialSignIn: false,
      }),
    ).toBe("stale");
  });
});
