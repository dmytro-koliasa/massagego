import { IN_APP_NOTIFICATION_RETENTION_DAYS } from "@/lib/booking-constants";

/** Pure cutoff helper (safe for unit tests without Prisma). */
export function inAppRetentionCutoff(now = new Date()): Date {
  return new Date(
    now.getTime() - IN_APP_NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
}
