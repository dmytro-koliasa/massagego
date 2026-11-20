/**
 * #124 — createAndSendResetLink embeds AUTH_URL, not the caller host.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendEmailMock = vi.hoisted(() =>
  vi.fn(async () => ({ ok: true as const, mode: "log" as const })),
);

const findPortalUserByEmail = vi.hoisted(() => vi.fn());
const findPortalUserByPhone = vi.hoisted(() => vi.fn());
const deleteMany = vi.hoisted(() => vi.fn());
const createToken = vi.hoisted(() => vi.fn());

vi.mock("@/lib/email/sender", () => ({
  sendEmail: sendEmailMock,
}));

vi.mock("@/lib/portals.server", () => ({
  findPortalUserByEmail,
  findPortalUserByPhone,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (ops: unknown) => Promise.all(ops as Promise<unknown>[]),
    verificationToken: {
      deleteMany,
      create: createToken,
    },
  },
}));

import { createAndSendResetLink } from "@/lib/email/password-reset";

describe("createAndSendResetLink origin (#124)", () => {
  const previousAuthUrl = process.env.AUTH_URL;

  beforeEach(() => {
    sendEmailMock.mockClear();
    findPortalUserByEmail.mockReset();
    findPortalUserByPhone.mockReset();
    deleteMany.mockReset();
    createToken.mockReset();
    deleteMany.mockResolvedValue({ count: 0 });
    createToken.mockResolvedValue({});
    findPortalUserByEmail.mockResolvedValue({
      id: "u1",
      email: "masseur@example.com",
      emailVerified: new Date(),
      passwordHash: "hash",
    });
  });

  afterEach(() => {
    if (previousAuthUrl === undefined) {
      delete process.env.AUTH_URL;
    } else {
      process.env.AUTH_URL = previousAuthUrl;
    }
  });

  it("mails a reset URL whose host is AUTH_URL, not an evil request host", async () => {
    process.env.AUTH_URL = "https://trusted.example";

    await createAndSendResetLink({
      portal: "masseur",
      email: "masseur@example.com",
      locale: "en",
    });

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringMatching(
          /^[\s\S]*https:\/\/trusted\.example\/masseur\/login\?resetToken=[0-9a-f]+[\s\S]*$/,
        ),
        html: expect.not.stringContaining("evil.example"),
      }),
    );
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.not.stringContaining("evil.example"),
      }),
    );
  });

  it("does not send or create a token when AUTH_URL is missing", async () => {
    delete process.env.AUTH_URL;

    const result = await createAndSendResetLink({
      portal: "masseur",
      email: "masseur@example.com",
      locale: "en",
    });

    expect(result).toEqual({ ok: true });
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(createToken).not.toHaveBeenCalled();
  });

  it("mails a reclaim link for unverified accounts (#128 A)", async () => {
    process.env.AUTH_URL = "https://trusted.example";
    findPortalUserByEmail.mockResolvedValue({
      id: "u-unverified",
      email: "taken@example.com",
      emailVerified: null,
      passwordHash: "hash",
    });

    await createAndSendResetLink({
      portal: "masseur",
      email: "taken@example.com",
      locale: "en",
    });

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Confirm your email and set a password",
        text: expect.stringMatching(
          /^[\s\S]*https:\/\/trusted\.example\/masseur\/login\?resetToken=[0-9a-f]+[\s\S]*$/,
        ),
      }),
    );
    expect(createToken).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          identifier: "email-reclaim:u-unverified",
        }),
      }),
    );
  });
});
