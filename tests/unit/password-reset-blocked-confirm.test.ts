/**
 * Phase 8 #181 / FR-5 — consumeResetToken rejects blocked accounts as invalid_token.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "crypto";

const findUniqueUser = vi.hoisted(() => vi.fn());
const findUniqueToken = vi.hoisted(() => vi.fn());
const deleteManyTokens = vi.hoisted(() => vi.fn());
const deleteToken = vi.hoisted(() => vi.fn());

vi.mock("@/lib/email/sender", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/portals.server", () => ({
  findPortalUserByEmail: vi.fn(),
  findPortalUserByPhone: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (ops: unknown) => Promise.all(ops as Promise<unknown>[]),
    user: {
      findUnique: (...args: unknown[]) => findUniqueUser(...args),
      update: vi.fn(),
    },
    session: {
      deleteMany: vi.fn(),
    },
    verificationToken: {
      findUnique: (...args: unknown[]) => findUniqueToken(...args),
      delete: (...args: unknown[]) => deleteToken(...args),
      deleteMany: (...args: unknown[]) => deleteManyTokens(...args),
      create: vi.fn(),
    },
  },
}));

vi.mock("bcryptjs", () => ({
  hash: vi.fn(async () => "new-hash"),
}));

import { consumeResetToken } from "@/lib/email/password-reset";

describe("consumeResetToken blocked (#181)", () => {
  beforeEach(() => {
    findUniqueUser.mockReset();
    findUniqueToken.mockReset();
    deleteManyTokens.mockReset();
    deleteToken.mockReset();
    deleteManyTokens.mockResolvedValue({ count: 1 });
  });

  it("returns invalid_token when the account is blocked", async () => {
    const rawToken = "a".repeat(64);
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    findUniqueToken.mockResolvedValue({
      token: tokenHash,
      identifier: "password-reset:user-blocked",
      expires: new Date(Date.now() + 60_000),
    });
    findUniqueUser.mockResolvedValue({
      id: "user-blocked",
      emailVerified: new Date(),
      deletedAt: null,
      blockedAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    const result = await consumeResetToken({
      rawToken,
      password: "NewPass1!",
      passwordConfirm: "NewPass1!",
    });

    expect(result).toEqual({ ok: false, error: "invalid_token" });
    expect(deleteManyTokens).toHaveBeenCalled();
  });
});
