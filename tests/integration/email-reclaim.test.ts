/**
 * #128 A — unverified occupancy reclaim; verified accounts keep normal reset.
 */
import { compare, hash } from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { completeMasseurData } from "./fixtures";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
}

const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

type SentMail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

const sendEmailMock = vi.hoisted(() => {
  const fn = vi.fn<(payload: SentMail) => Promise<{ ok: true; mode: "log" }>>();
  fn.mockImplementation(async () => ({ ok: true, mode: "log" }));
  return fn;
});

vi.mock("@/lib/email/sender", () => ({
  sendEmail: sendEmailMock,
}));

describeDb("unverified email reclaim (#128)", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let createAndSendResetLink: typeof import("@/lib/email/password-reset").createAndSendResetLink;
  let consumeResetToken: typeof import("@/lib/email/password-reset").consumeResetToken;
  let hashPasswordResetToken: typeof import("@/lib/email/password-reset").hashPasswordResetToken;

  const ids: string[] = [];
  const previousAuthUrl = process.env.AUTH_URL;

  beforeAll(async () => {
    process.env.AUTH_URL = "https://trusted.example";
    ({ prisma } = await import("@/lib/prisma"));
    ({ createAndSendResetLink, consumeResetToken, hashPasswordResetToken } =
      await import("@/lib/email/password-reset"));
  });

  afterAll(async () => {
    if (previousAuthUrl === undefined) {
      delete process.env.AUTH_URL;
    } else {
      process.env.AUTH_URL = previousAuthUrl;
    }
    if (!prisma) return;
    for (const id of ids) {
      await prisma.verificationToken.deleteMany({
        where: {
          OR: [
            { identifier: `password-reset:${id}` },
            { identifier: `email-reclaim:${id}` },
            { identifier: `email-verify:${id}` },
          ],
        },
      });
      await prisma.session.deleteMany({ where: { userId: id } });
      await prisma.user.deleteMany({ where: { id } });
    }
    await prisma.$disconnect();
  });

  it("lets the mailbox owner reclaim an unverified row with a new password", async () => {
    sendEmailMock.mockClear();
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const attackerHash = await hash("AttackerPass1!", 12);
    const user = await prisma.user.create({
      data: completeMasseurData({
        email: `reclaim-${suffix}@test.local`,
        phone: `+38063${String(Date.now()).slice(-7)}`,
        passwordHash: attackerHash,
        emailVerified: null,
        passwordChangedAt: null,
      }),
    });
    ids.push(user.id);

    await createAndSendResetLink({
      portal: "masseur",
      email: user.email!,
      locale: "en",
    });

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const mailed = sendEmailMock.mock.calls[0]![0];
    expect(mailed.subject).toMatch(/Confirm your email and set a password/i);
    const match = mailed.text.match(/resetToken=([0-9a-f]+)/i);
    expect(match?.[1]).toBeTruthy();
    const rawToken = match![1]!;

    const reclaimRow = await prisma.verificationToken.findUnique({
      where: { token: hashPasswordResetToken(rawToken) },
    });
    expect(reclaimRow?.identifier).toBe(`email-reclaim:${user.id}`);

    const result = await consumeResetToken({
      rawToken,
      password: "OwnerPass1!",
      passwordConfirm: "OwnerPass1!",
    });
    expect(result).toEqual({ ok: true, userId: user.id });

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        emailVerified: true,
        passwordHash: true,
        passwordChangedAt: true,
      },
    });
    expect(after.emailVerified).toBeInstanceOf(Date);
    expect(after.passwordChangedAt).toBeInstanceOf(Date);
    expect(after.passwordHash).toBeTruthy();
    expect(await compare("OwnerPass1!", after.passwordHash!)).toBe(true);
    expect(await compare("AttackerPass1!", after.passwordHash!)).toBe(false);

    expect(
      await prisma.verificationToken.count({
        where: {
          OR: [
            { identifier: `email-reclaim:${user.id}` },
            { identifier: `password-reset:${user.id}` },
          ],
        },
      }),
    ).toBe(0);
  });

  it("keeps verified accounts on the normal reset path (no reclaim)", async () => {
    sendEmailMock.mockClear();
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const oldHash = await hash("VerifiedOld1!", 12);
    const user = await prisma.user.create({
      data: completeMasseurData({
        email: `verified-reset-${suffix}@test.local`,
        phone: `+38066${String(Date.now()).slice(-7)}`,
        passwordHash: oldHash,
        emailVerified: new Date("2030-01-01T00:00:00.000Z"),
        passwordChangedAt: null,
      }),
    });
    ids.push(user.id);

    await createAndSendResetLink({
      portal: "masseur",
      email: user.email!,
      locale: "en",
    });

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const mailed = sendEmailMock.mock.calls[0]![0];
    expect(mailed.subject).toMatch(/^Reset your password$/i);
    expect(mailed.subject).not.toMatch(/Confirm your email/i);
    const match = mailed.text.match(/resetToken=([0-9a-f]+)/i);
    expect(match?.[1]).toBeTruthy();
    const rawToken = match![1]!;

    const resetRow = await prisma.verificationToken.findUnique({
      where: { token: hashPasswordResetToken(rawToken) },
    });
    expect(resetRow?.identifier).toBe(`password-reset:${user.id}`);
    expect(
      await prisma.verificationToken.count({
        where: { identifier: `email-reclaim:${user.id}` },
      }),
    ).toBe(0);

    const verifiedAtBefore = (
      await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { emailVerified: true },
      })
    ).emailVerified;

    const result = await consumeResetToken({
      rawToken,
      password: "VerifiedNew1!",
      passwordConfirm: "VerifiedNew1!",
    });
    expect(result).toEqual({ ok: true, userId: user.id });

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        emailVerified: true,
        passwordHash: true,
        passwordChangedAt: true,
      },
    });
    expect(after.emailVerified?.getTime()).toBe(verifiedAtBefore?.getTime());
    expect(after.passwordChangedAt).toBeInstanceOf(Date);
    expect(await compare("VerifiedNew1!", after.passwordHash!)).toBe(true);
  });

  it("rejects a reclaim token once the account is already verified", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const passwordHash = await hash("TempPass1!", 12);
    const user = await prisma.user.create({
      data: completeMasseurData({
        email: `reclaim-stale-${suffix}@test.local`,
        phone: `+38068${String(Date.now()).slice(-7)}`,
        passwordHash,
        emailVerified: null,
      }),
    });
    ids.push(user.id);

    const { randomBytes } = await import("crypto");
    const rawToken = randomBytes(32).toString("hex");
    await prisma.verificationToken.create({
      data: {
        identifier: `email-reclaim:${user.id}`,
        token: hashPasswordResetToken(rawToken),
        expires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
    });

    const result = await consumeResetToken({
      rawToken,
      password: "ShouldFail1!",
      passwordConfirm: "ShouldFail1!",
    });
    expect(result).toEqual({ ok: false, error: "invalid_token" });

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    expect(await compare("TempPass1!", after.passwordHash!)).toBe(true);
  });
});
