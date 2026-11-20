import { createHash, randomBytes } from "crypto";
import { hash } from "bcryptjs";
import {
  buildTrustedAppUrl,
  resolveTrustedAppOrigin,
} from "@/lib/auth/trusted-origin";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/sender";
import { isSyntheticClientEmail } from "@/lib/email/verification";
import type { Portal } from "@/lib/portals";
import { portalHomePath } from "@/lib/portals";
import {
  findPortalUserByEmail,
  findPortalUserByPhone,
} from "@/lib/portals.server";

export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const RESET_PREFIX = "password-reset:";

function identifierFor(userId: string) {
  return `${RESET_PREFIX}${userId}`;
}

/** Exported for unit tests — same SHA-256 scheme as email-verify tokens. */
export function hashPasswordResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Site-relative reset path used in mailed links (#124). */
export function passwordResetLinkPath(portal: Portal, rawToken: string): string {
  return `${portalHomePath(portal)}?resetToken=${encodeURIComponent(rawToken)}`;
}

export type PasswordResetRequestResult = { ok: true };

/**
 * Always succeeds from the caller's perspective. Email is sent only when the
 * user has a passwordHash and a verified, non-synthetic email, and AUTH_URL
 * is configured (#124). Never uses the request Host for the link.
 */
export async function createAndSendResetLink(options: {
  portal: Portal;
  phone?: string;
  email?: string;
  locale: "en" | "uk";
}): Promise<PasswordResetRequestResult> {
  const user =
    options.portal === "client" && options.phone
      ? await findPortalUserByPhone(options.phone, "client")
      : options.portal === "masseur" && options.email
        ? await findPortalUserByEmail(options.email, "masseur")
        : null;

  if (
    !user?.passwordHash ||
    !user.emailVerified ||
    !user.email?.trim() ||
    isSyntheticClientEmail(user.email)
  ) {
    return { ok: true };
  }

  const trusted = resolveTrustedAppOrigin();
  if (!trusted.ok) {
    // Enumeration-safe: same response as an unknown account. No token written.
    console.error("[password-reset] AUTH_URL unavailable", trusted.error);
    return { ok: true };
  }

  const now = Date.now();
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashPasswordResetToken(rawToken);
  const expires = new Date(now + PASSWORD_RESET_TTL_MS);
  const identifier = identifierFor(user.id);

  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier } }),
    prisma.verificationToken.create({
      data: { identifier, token: tokenHash, expires },
    }),
  ]);

  const resetUrl = buildTrustedAppUrl(
    trusted.origin,
    passwordResetLinkPath(options.portal, rawToken),
  );
  const subject =
    options.locale === "uk" ? "Скидання пароля" : "Reset your password";
  const text =
    options.locale === "uk"
      ? `Відкрийте посилання, щоб встановити новий пароль (дійсне 1 годину):\n${resetUrl}`
      : `Open this link to set a new password (valid for 1 hour):\n${resetUrl}`;
  const html = `<p>${text.replace(/\n/g, "<br/>")}</p>`;

  const sent = await sendEmail({
    to: user.email,
    subject,
    text,
    html,
  });
  if (!sent.ok) {
    // Still return ok to the API (enumeration-safe); log for ops.
    console.error("[password-reset] send failed", sent.error);
  }

  return { ok: true };
}

export type ConsumeResetTokenResult =
  | { ok: true; userId: string }
  | { ok: false; error: "invalid_token" | "password_mismatch" };

/**
 * Sets a new passwordHash, bumps `passwordChangedAt` (JWT invalidation #79),
 * deletes all Session rows for the user, and removes password-reset tokens.
 */
export async function consumeResetToken(options: {
  rawToken: string;
  password: string;
  passwordConfirm: string;
}): Promise<ConsumeResetTokenResult> {
  if (options.password !== options.passwordConfirm) {
    return { ok: false, error: "password_mismatch" };
  }

  const tokenHash = hashPasswordResetToken(options.rawToken.trim());
  const row = await prisma.verificationToken.findUnique({
    where: { token: tokenHash },
  });
  if (!row || row.expires.getTime() < Date.now()) {
    if (row) {
      await prisma.verificationToken
        .delete({ where: { token: tokenHash } })
        .catch(() => null);
    }
    return { ok: false, error: "invalid_token" };
  }
  if (!row.identifier.startsWith(RESET_PREFIX)) {
    return { ok: false, error: "invalid_token" };
  }
  const userId = row.identifier.slice(RESET_PREFIX.length);
  if (!userId) return { ok: false, error: "invalid_token" };

  const passwordHash = await hash(options.password, 12);
  const passwordChangedAt = new Date();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash, passwordChangedAt },
    }),
    prisma.session.deleteMany({ where: { userId } }),
    prisma.verificationToken.deleteMany({ where: { identifier: row.identifier } }),
  ]);

  return { ok: true, userId };
}
