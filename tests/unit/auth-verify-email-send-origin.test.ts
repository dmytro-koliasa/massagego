/**
 * #124 — createAndSendVerificationLink embeds AUTH_URL only.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendEmailMock = vi.hoisted(() =>
  vi.fn(async () => ({ ok: true as const, mode: "log" as const })),
);

const findUnique = vi.hoisted(() => vi.fn());
const deleteMany = vi.hoisted(() => vi.fn());
const createToken = vi.hoisted(() => vi.fn());
const updateUser = vi.hoisted(() => vi.fn());

vi.mock("@/lib/email/sender", () => ({
  sendEmail: sendEmailMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique,
      update: updateUser,
    },
    $transaction: (ops: unknown) => Promise.all(ops as Promise<unknown>[]),
    verificationToken: {
      deleteMany,
      create: createToken,
    },
  },
}));

import { createAndSendVerificationLink } from "@/lib/email/verification";

describe("createAndSendVerificationLink origin (#124)", () => {
  const previousAuthUrl = process.env.AUTH_URL;

  beforeEach(() => {
    sendEmailMock.mockClear();
    findUnique.mockReset();
    deleteMany.mockReset();
    createToken.mockReset();
    updateUser.mockReset();
    deleteMany.mockResolvedValue({ count: 0 });
    createToken.mockResolvedValue({});
    updateUser.mockResolvedValue({});
    findUnique.mockResolvedValue({
      id: "u1",
      emailVerified: null,
      emailVerifyLastSentAt: null,
      emailVerifySendWindowStart: null,
      emailVerifySendCount: 0,
    });
  });

  afterEach(() => {
    if (previousAuthUrl === undefined) {
      delete process.env.AUTH_URL;
    } else {
      process.env.AUTH_URL = previousAuthUrl;
    }
  });

  it("mails a verify URL on AUTH_URL and never an evil host", async () => {
    process.env.AUTH_URL = "https://trusted.example";

    const result = await createAndSendVerificationLink({
      userId: "u1",
      email: "client@example.com",
      locale: "en",
    });

    expect(result).toEqual({ ok: true });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringMatching(
          /^[\s\S]*https:\/\/trusted\.example\/api\/auth\/verify-email\?token=[0-9a-f]+[\s\S]*$/,
        ),
      }),
    );
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.not.stringContaining("evil.example"),
      }),
    );
  });

  it("returns email_not_configured without creating a token when AUTH_URL is missing", async () => {
    delete process.env.AUTH_URL;

    const result = await createAndSendVerificationLink({
      userId: "u1",
      email: "client@example.com",
      locale: "en",
    });

    expect(result).toEqual({ ok: false, error: "email_not_configured" });
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(createToken).not.toHaveBeenCalled();
  });
});
