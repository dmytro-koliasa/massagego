import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { rateLimitBucketEligibleBefore } from "@/lib/rate-limit-cleanup-rules";

export const RATE_LIMITS = {
  signIn: { limit: 10, windowMs: 15 * 60 * 1000 },
  register: { limit: 5, windowMs: 60 * 60 * 1000 },
  passwordReset: { limit: 5, windowMs: 60 * 60 * 1000 },
  bookingCreate: { limit: 30, windowMs: 15 * 60 * 1000 },
  bookingCancel: { limit: 30, windowMs: 15 * 60 * 1000 },
  /** Masseur bulk-cancel of all future bookings (X-4) — few times per hour. */
  masseurBulkCancel: { limit: 5, windowMs: 60 * 60 * 1000 },
  complaintCreate: { limit: 5, windowMs: 60 * 60 * 1000 },
} as const;

/**
 * Hash a subject (IP, email, phone, user id) so `RateLimitBucket.key`
 * never stores raw identifiers (#81).
 */
export function hashRateLimitSubject(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Build `scope:sha256(subject)` keys used by all rate-limit call sites. */
export function rateLimitKey(scope: string, subject: string): string {
  return `${scope}:${hashRateLimitSubject(subject)}`;
}

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

/** Prisma unique-constraint violation (e.g. concurrent first insert on key). */
export function isUniqueConstraintError(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

/**
 * Atomic sliding-window check: window starts on the first hit after expiry,
 * then increments until `limit` within `windowMs`.
 *
 * Concurrent first inserts on an empty key race past `SELECT … FOR UPDATE`
 * (no row to lock). Catch P2002 and re-enter the transaction (#85).
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  nowMs = Date.now(),
): Promise<RateLimitResult> {
  const now = new Date(nowMs);
  const maxUniqueRetries = 3;

  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
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
            retryAfterSec: retryAfterSec(
              row.windowStart.getTime(),
              windowMs,
              nowMs,
            ),
          };
        }

        await tx.rateLimitBucket.update({
          where: { key },
          data: { count: { increment: 1 } },
        });
        return { ok: true as const };
      });
    } catch (error) {
      if (!isUniqueConstraintError(error) || attempt >= maxUniqueRetries) {
        throw error;
      }
    }
  }
}

/**
 * Hard-delete idle rate-limit buckets whose window can no longer matter (#81).
 * Logs counts only (keys are already hashed subjects).
 */
export async function deleteExpiredRateLimitBuckets(options?: {
  now?: Date;
  limit?: number;
}): Promise<{ deleted: number }> {
  const now = options?.now ?? new Date();
  const limit = options?.limit ?? 500;
  const before = rateLimitBucketEligibleBefore(now);

  const rows = await prisma.rateLimitBucket.findMany({
    where: { windowStart: { lte: before } },
    select: { id: true },
    take: limit,
    orderBy: { windowStart: "asc" },
  });
  if (rows.length === 0) return { deleted: 0 };

  const result = await prisma.rateLimitBucket.deleteMany({
    where: { id: { in: rows.map((row) => row.id) } },
  });
  return { deleted: result.count };
}
