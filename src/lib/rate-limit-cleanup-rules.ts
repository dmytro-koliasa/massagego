import { RATE_LIMIT_BUCKET_GRACE_MS } from "@/lib/booking-constants";

/**
 * Must stay ≥ longest `RATE_LIMITS.*.windowMs` (currently 1 hour).
 * Kept here (not imported from rate-limit) to avoid a circular module graph.
 */
export const RATE_LIMIT_MAX_WINDOW_MS = 60 * 60 * 1000;

/**
 * Cutoff for deleting idle `RateLimitBucket` rows (#81).
 * `windowStart` older than max window + grace → safe to purge.
 */
export function rateLimitBucketEligibleBefore(now = new Date()): Date {
  return new Date(
    now.getTime() - RATE_LIMIT_MAX_WINDOW_MS - RATE_LIMIT_BUCKET_GRACE_MS,
  );
}
