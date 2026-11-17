import { prisma } from "@/lib/prisma";

export const RATE_LIMITS = {
  signIn: { limit: 10, windowMs: 15 * 60 * 1000 },
  register: { limit: 5, windowMs: 60 * 60 * 1000 },
  passwordReset: { limit: 5, windowMs: 60 * 60 * 1000 },
  bookingCreate: { limit: 30, windowMs: 15 * 60 * 1000 },
  bookingCancel: { limit: 30, windowMs: 15 * 60 * 1000 },
  complaintCreate: { limit: 5, windowMs: 60 * 60 * 1000 },
} as const;

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

/** Seconds until the current window ends (at least 1). */
export function retryAfterSec(
  windowStartMs: number,
  windowMs: number,
  nowMs: number,
): number {
  return Math.max(1, Math.ceil((windowStartMs + windowMs - nowMs) / 1000));
}

/** Display minutes for the user-facing rate-limit message (at least 1). */
export function minutesFromRetryAfter(retryAfterSeconds: number): number {
  return Math.max(1, Math.ceil(retryAfterSeconds / 60));
}

export function formatRateLimitMessage(
  locale: "en" | "uk",
  minutes: number,
): string {
  return locale === "uk"
    ? `Забагато спроб. Спробуйте знову через ${minutes} хв.`
    : `Too many attempts. Try again in ${minutes} min.`;
}

export function isWindowExpired(
  windowStartMs: number,
  windowMs: number,
  nowMs: number,
): boolean {
  return nowMs - windowStartMs >= windowMs;
}

/**
 * Atomic sliding-window check: window starts on the first hit after expiry,
 * then increments until `limit` within `windowMs`.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  nowMs = Date.now(),
): Promise<RateLimitResult> {
  const now = new Date(nowMs);

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      { id: string; windowStart: Date; count: number }[]
    >`SELECT id, "windowStart", count FROM "RateLimitBucket" WHERE key = ${key} FOR UPDATE`;

    const row = rows[0];
    if (!row || isWindowExpired(row.windowStart.getTime(), windowMs, nowMs)) {
      if (row) {
        await tx.rateLimitBucket.update({
          where: { key },
          data: { windowStart: now, count: 1 },
        });
      } else {
        await tx.rateLimitBucket.create({
          data: { key, windowStart: now, count: 1 },
        });
      }
      return { ok: true as const };
    }

    if (row.count >= limit) {
      return {
        ok: false as const,
        retryAfterSec: retryAfterSec(row.windowStart.getTime(), windowMs, nowMs),
      };
    }

    await tx.rateLimitBucket.update({
      where: { key },
      data: { count: { increment: 1 } },
    });
    return { ok: true as const };
  });
}
