import { createHash, randomBytes } from "crypto";
import {
  buildTrustedAppUrl,
  resolveTrustedAppOrigin,
} from "@/lib/auth/trusted-origin";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/sender";

export const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
export const EMAIL_VERIFY_RESEND_MIN_MS = 60 * 1000;
export const EMAIL_VERIFY_MAX_PER_HOUR = 5;

const VERIFY_PREFIX = "email-verify:";

function identifierFor(userId: string) {
  return `${VERIFY_PREFIX}${userId}`;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Site-relative verify path used in mailed links (#124). */
export function emailVerifyLinkPath(rawToken: string): string {
  return `/api/auth/verify-email?token=${encodeURIComponent(rawToken)}`;
}

export type VerificationSendResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | "already_verified"
        | "resend_too_soon"
        | "resend_limit"
        | "email_not_configured"
        | "send_failed"
        | "not_found";
      retryAfterSec?: number;
    };

/**
 * Send a one-time verify link built from AUTH_URL only (#124).
 * Does not accept a request-derived origin.
 */
export async function createAndSendVerificationLink(options: {
  userId: string;
  email: string;
  locale: "en" | "uk";
}): Promise<VerificationSendResult> {
  const user = await prisma.user.findUnique({
    where: { id: options.userId },
    select: {
      id: true,
      emailVerified: true,
      emailVerifyLastSentAt: true,
      emailVerifySendWindowStart: true,
      emailVerifySendCount: true,
    },
  });
  if (!user) return { ok: false, error: "not_found" };
  if (user.emailVerified) return { ok: false, error: "already_verified" };

  const trusted = resolveTrustedAppOrigin();
  if (!trusted.ok) {
    console.error("[email-verify] AUTH_URL unavailable", trusted.error);
    return { ok: false, error: "email_not_configured" };
  }

  const now = Date.now();
  if (user.emailVerifyLastSentAt) {
    const elapsed = now - user.emailVerifyLastSentAt.getTime();
    if (elapsed < EMAIL_VERIFY_RESEND_MIN_MS) {
      return {
        ok: false,
        error: "resend_too_soon",
        retryAfterSec: Math.ceil(
          (EMAIL_VERIFY_RESEND_MIN_MS - elapsed) / 1000,
        ),
      };
    }
  }

  let sendCount = user.emailVerifySendCount;
  let windowStart = user.emailVerifySendWindowStart;
  if (!windowStart || now - windowStart.getTime() >= 60 * 60 * 1000) {
    windowStart = new Date(now);
    sendCount = 0;
  }
  if (sendCount >= EMAIL_VERIFY_MAX_PER_HOUR) {
    return { ok: false, error: "resend_limit" };
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expires = new Date(now + EMAIL_VERIFY_TTL_MS);
  const identifier = identifierFor(options.userId);

  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier } }),
    prisma.verificationToken.create({
      data: { identifier, token: tokenHash, expires },
    }),
    prisma.user.update({
      where: { id: options.userId },
      data: {
        emailVerifyLastSentAt: new Date(now),
        emailVerifySendWindowStart: windowStart,
        emailVerifySendCount: sendCount + 1,
      },
    }),
  ]);

  const verifyUrl = buildTrustedAppUrl(
    trusted.origin,
    emailVerifyLinkPath(rawToken),
  );
  const subject =
    options.locale === "uk"
      ? "Підтвердіть email"
      : "Confirm your email";
  const text =
    options.locale === "uk"
      ? `Відкрийте посилання, щоб підтвердити email (дійсне 24 години):\n${verifyUrl}`
      : `Open this link to confirm your email (valid for 24 hours):\n${verifyUrl}`;
  const html = `<p>${text.replace(/\n/g, "<br/>")}</p>`;

  const sent = await sendEmail({
    to: options.email,
    subject,
    text,
    html,
  });
  if (!sent.ok) {
    return { ok: false, error: sent.error };
  }
  return { ok: true };
}

export async function consumeVerificationToken(
  rawToken: string,
): Promise<{ ok: true; userId: string } | { ok: false; error: "invalid_token" }> {
  const tokenHash = hashToken(rawToken.trim());
  const row = await prisma.verificationToken.findUnique({
    where: { token: tokenHash },
  });
  if (!row || row.expires.getTime() < Date.now()) {
    if (row) {
      await prisma.verificationToken.delete({ where: { token: tokenHash } }).catch(() => null);
    }
    return { ok: false, error: "invalid_token" };
  }
  if (!row.identifier.startsWith(VERIFY_PREFIX)) {
    return { ok: false, error: "invalid_token" };
  }
  const userId = row.identifier.slice(VERIFY_PREFIX.length);
  if (!userId) return { ok: false, error: "invalid_token" };

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { emailVerified: new Date() },
    }),
    prisma.verificationToken.deleteMany({ where: { identifier: row.identifier } }),
  ]);

  return { ok: true, userId };
}

export function isSyntheticClientEmail(email: string): boolean {
  return email.toLowerCase().endsWith("@client.local");
}
