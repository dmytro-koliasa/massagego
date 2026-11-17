import {
  NOTIFICATION_RETRY_BACKOFF_MINUTES,
  NOTIFICATION_RETRY_MAX_AGE_MS,
} from "@/lib/notifications/types";

export function nextRetryAt(
  attemptCountAfterFailure: number,
  from: Date = new Date(),
): Date {
  const index = Math.min(
    Math.max(attemptCountAfterFailure - 1, 0),
    NOTIFICATION_RETRY_BACKOFF_MINUTES.length - 1,
  );
  const minutes = NOTIFICATION_RETRY_BACKOFF_MINUTES[index] ?? 30;
  return new Date(from.getTime() + minutes * 60 * 1000);
}

export function isPastRetryWindow(
  createdAt: Date,
  now: Date = new Date(),
): boolean {
  return now.getTime() - createdAt.getTime() >= NOTIFICATION_RETRY_MAX_AGE_MS;
}
