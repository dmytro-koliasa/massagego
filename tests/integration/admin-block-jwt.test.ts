/**
 * Phase 8 #178 / FR-1 — admin block bumps passwordChangedAt so JWTs go stale.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { applyPasswordVersionToJwt } from "@/lib/auth/password-credential-version";
import { completeMasseurData } from "./fixtures";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
}

const session = vi.hoisted(() => ({ adminId: "" }));

vi.mock("@/auth/admin", () => ({
  auth: async () => ({
    user: { id: session.adminId, portal: "admin" },
  }),
}));

const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

describeDb("admin block JWT invalidation (#178)", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let blockUser: typeof import("@/app/api/admin/users/[id]/block/route").POST;
  let adminId = "";
  let masseurId = "";

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    ({ POST: blockUser } = await import(
      "@/app/api/admin/users/[id]/block/route"
    ));

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const admin = await prisma.user.create({
      data: {
        email: `block-jwt-admin-${suffix}@test.local`,
        portal: "admin",
        name: "Block JWT Admin",
      },
    });
    const masseur = await prisma.user.create({
      data: completeMasseurData({
        email: `block-jwt-m-${suffix}@test.local`,
        phone: `+38050${String(Date.now()).slice(-7)}`,
        passwordChangedAt: null,
      }),
    });
    adminId = admin.id;
    masseurId = masseur.id;
    session.adminId = admin.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.adminAuditLog.deleteMany({
      where: { actorUserId: adminId },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [adminId, masseurId].filter(Boolean) } },
    });
    await prisma.$disconnect();
  });

  it("bumps passwordChangedAt with blockedAt and stale-marks a pre-block JWT", async () => {
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: masseurId },
      select: { passwordChangedAt: true, blockedAt: true },
    });
    expect(before.blockedAt).toBeNull();
    expect(before.passwordChangedAt).toBeNull();

    const preBlockToken = { pwdChangedAt: 0 };
    expect(
      applyPasswordVersionToJwt({
        token: preBlockToken,
        dbPasswordChangedAt: before.passwordChangedAt,
        isInitialSignIn: false,
      }),
    ).toBe("ok");

    const blockRes = await blockUser(
      new Request("http://test/api/admin/users/x/block", { method: "POST" }),
      { params: Promise.resolve({ id: masseurId }) },
    );
    expect(blockRes.status).toBe(200);

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: masseurId },
      select: { passwordChangedAt: true, blockedAt: true },
    });
    expect(after.blockedAt).toBeInstanceOf(Date);
    expect(after.passwordChangedAt).toBeInstanceOf(Date);
    expect(after.passwordChangedAt?.getTime()).toBe(after.blockedAt?.getTime());

    expect(
      applyPasswordVersionToJwt({
        token: preBlockToken,
        dbPasswordChangedAt: after.passwordChangedAt,
        isInitialSignIn: false,
      }),
    ).toBe("stale");
  });
});
