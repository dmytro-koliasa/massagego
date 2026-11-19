import { DateTime } from "luxon";
import {
  OUTBOX_ABANDONED_GRACE_MS,
  OUTBOX_TERMINAL_RETENTION_DAYS,
} from "@/lib/booking-constants";
import { NOTIFICATION_RETRY_MAX_AGE_MS } from "@/lib/notifications/types";

/** Cutoff for deleting terminal (`sent` / `dead`) outbox rows (#81). */
export function outboxTerminalEligibleBefore(now = new Date()): Date {
  return DateTime.fromJSDate(now, { zone: "utc" })
    .minus({ days: OUTBOX_TERMINAL_RETENTION_DAYS })
    .toJSDate();
}

/**
 * Cutoff for safety-net purge of stuck live outbox rows
 * (`pending` / `failed` / `processing`) after retry max age + grace.
 */
export function outboxAbandonedEligibleBefore(now = new Date()): Date {
  return new Date(
    now.getTime() - NOTIFICATION_RETRY_MAX_AGE_MS - OUTBOX_ABANDONED_GRACE_MS,
  );
}
