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
/** Unverified occupancy reclaim (#128 option A). Same confirm UI as reset. */
const RECLAIM_PREFIX = "email-reclaim:";

function resetIdentifierFor(userId: string) {
  return `${RESET_PREFIX}${userId}`;
}

function reclaimIdentifierFor(userId: string) {
  return `${RECLAIM_PREFIX}${userId}`;
}

/** Exported for unit tests — same SHA-256 scheme as email-verify tokens. */
export function hashPasswordResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Site-relative reset/reclaim path used in mailed links (#124). */
export function passwordResetLinkPath(portal: Portal, rawToken: string): string {
  return `${portalHomePath(portal)}?resetToken=${encodeURIComponent(rawToken)}`;
}

export type PasswordResetRequestResult = { ok: true };

/**
 * Always succeeds from the caller's perspective (enumeration-safe).
 *
 * - Verified + password + real email: send a normal password-reset link.
 * - Unverified + password + real email (#128 A): send a reclaim link that
 *   sets `emailVerified` and replaces `passwordHash` on confirm.
 * - Missing user / no password / synthetic email: no mail, same response.
 * Never uses the request Host for the link (#124).
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
    !user.email?.trim() ||
    isSyntheticClientEmail(user.email) ||
    user.blockedAt
  ) {
    // Blocked: enumeration-safe — same as unknown account; no token / no mail.
    return { ok: true };
  }

  const reclaim = !user.emailVerified;

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
  const identifier = reclaim
    ? reclaimIdentifierFor(user.id)
    : resetIdentifierFor(user.id);

  await prisma.$transaction([
    // Drop both flavours so a later verify/reclaim cannot leave a stale twin.
    prisma.verificationToken.deleteMany({
      where: {
        OR: [
          { identifier: resetIdentifierFor(user.id) },
          { identifier: reclaimIdentifierFor(user.id) },
        ],
      },
    }),
    prisma.verificationToken.create({
      data: { identifier, token: tokenHash, expires },
    }),
  ]);

  const resetUrl = buildTrustedAppUrl(
    trusted.origin,
    passwordResetLinkPath(options.portal, rawToken),
  );

  const subject = reclaim
    ? options.locale === "uk"
      ? "Підтвердіть email і встановіть пароль"
      : "Confirm your email and set a password"
    : options.locale === "uk"
      ? "Скидання пароля"
      : "Reset your password";

  const text = reclaim
    ? options.locale === "uk"
      ? `Відкрийте посилання, щоб підтвердити email і встановити новий пароль (дійсне 1 годину):\n${resetUrl}`
      : `Open this link to confirm your email and set a new password (valid for 1 hour):\n${resetUrl}`
    : options.locale === "uk"
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
 * deletes Session rows, and removes reset/reclaim tokens.
 * Reclaim tokens (#128 A) also set `emailVerified` when the row is still unverified.
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

  const isReset = row.identifier.startsWith(RESET_PREFIX);
  const isReclaim = row.identifier.startsWith(RECLAIM_PREFIX);
  if (!isReset && !isReclaim) {
    return { ok: false, error: "invalid_token" };
  }

  const userId = row.identifier.slice(
    isReclaim ? RECLAIM_PREFIX.length : RESET_PREFIX.length,
  );
  if (!userId) return { ok: false, error: "invalid_token" };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      emailVerified: true,
      deletedAt: true,
      blockedAt: true,
    },
  });
  if (!user || user.deletedAt || user.blockedAt) {
    await prisma.verificationToken
      .deleteMany({ where: { identifier: row.identifier } })
      .catch(() => null);
    return { ok: false, error: "invalid_token" };
  }

  // Reclaim is only for unverified rows. If the account was verified meanwhile
  // (e.g. attacker verify link), reject the reclaim token — use a normal reset.
  if (isReclaim && user.emailVerified) {
    await prisma.verificationToken
      .deleteMany({ where: { identifier: row.identifier } })
      .catch(() => null);
    return { ok: false, error: "invalid_token" };
  }

  const passwordHash = await hash(options.password, 12);
  const passwordChangedAt = new Date();
  const emailVerified = isReclaim ? passwordChangedAt : undefined;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        passwordChangedAt,
        ...(emailVerified ? { emailVerified } : {}),
      },
    }),
    prisma.session.deleteMany({ where: { userId } }),
    prisma.verificationToken.deleteMany({
      where: {
        OR: [
          { identifier: resetIdentifierFor(userId) },
          { identifier: reclaimIdentifierFor(userId) },
          // Drop pending verify tokens — reclaim already proved the mailbox.
          ...(isReclaim
            ? [{ identifier: `email-verify:${userId}` }]
            : []),
        ],
      },
    }),
  ]);

  return { ok: true, userId };
}
