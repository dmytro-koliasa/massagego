import "server-only";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { telegramBotUsername, telegramConfigured } from "@/lib/telegram/config";

export { samePersonContact } from "@/lib/telegram/phone";

export const TELEGRAM_LINK_TTL_MS = 15 * 60 * 1000;
const LINK_PREFIX = "telegram-link:";

function identifierFor(userId: string) {
  return `${LINK_PREFIX}${userId}`;
}

export function hashTelegramLinkToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function telegramDeepLinkUrl(rawToken: string): string | null {
  const username = telegramBotUsername();
  if (!username) return null;
  return `https://t.me/${username}?start=${rawToken}`;
}

export async function createTelegramLinkToken(userId: string): Promise<
  | { ok: true; rawToken: string; url: string; expiresAt: Date }
  | { ok: false; error: "telegram_not_configured" }
> {
  if (!telegramConfigured()) {
    return { ok: false, error: "telegram_not_configured" };
  }

  const rawToken = randomBytes(16).toString("hex");
  const tokenHash = hashTelegramLinkToken(rawToken);
  const expiresAt = new Date(Date.now() + TELEGRAM_LINK_TTL_MS);
  const identifier = identifierFor(userId);

  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier } }),
    prisma.verificationToken.create({
      data: { identifier, token: tokenHash, expires: expiresAt },
    }),
  ]);

  const url = telegramDeepLinkUrl(rawToken);
  if (!url) {
    return { ok: false, error: "telegram_not_configured" };
  }

  return { ok: true, rawToken, url, expiresAt };
}

export type ConsumeTelegramLinkResult =
  | { ok: true; userId: string }
  | {
      ok: false;
      error: "invalid_token" | "expired_token";
    };

export async function consumeTelegramLinkToken(
  rawToken: string,
): Promise<ConsumeTelegramLinkResult> {
  const tokenHash = hashTelegramLinkToken(rawToken.trim());
  const row = await prisma.verificationToken.findUnique({
    where: { token: tokenHash },
  });
  if (!row || !row.identifier.startsWith(LINK_PREFIX)) {
    return { ok: false, error: "invalid_token" };
  }
  if (row.expires.getTime() < Date.now()) {
    await prisma.verificationToken.deleteMany({
      where: { identifier: row.identifier },
    });
    return { ok: false, error: "expired_token" };
  }

  const userId = row.identifier.slice(LINK_PREFIX.length);
  await prisma.verificationToken.deleteMany({
    where: { identifier: row.identifier },
  });
  return { ok: true, userId };
}
