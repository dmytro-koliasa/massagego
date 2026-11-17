export const NOTIFICATION_EVENT_TYPES = [
  "booking_created",
  "booking_cancelled_by_client",
  "booking_cancelled_by_masseur",
  "booking_cancelled_client_deleted",
  "booking_confirmed",
] as const;

export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];

/** Cancellations + confirmation must keep ≥1 channel (email until Telegram). */
export const CRITICAL_NOTIFICATION_EVENTS: ReadonlySet<NotificationEventType> =
  new Set([
    "booking_cancelled_by_client",
    "booking_cancelled_by_masseur",
    "booking_cancelled_client_deleted",
    "booking_confirmed",
  ]);

/** Which portal role receives each event. */
export const NOTIFICATION_EVENT_RECIPIENT_PORTAL: Record<
  NotificationEventType,
  "masseur" | "client"
> = {
  booking_created: "masseur",
  booking_cancelled_by_client: "masseur",
  booking_cancelled_by_masseur: "client",
  booking_cancelled_client_deleted: "masseur",
  booking_confirmed: "client",
};

export type NotificationPayload = {
  locale: "en" | "uk";
  slotStartIso: string;
  timeZone: string;
  timeZoneLabel: string;
  massageType: string | null;
  otherPartyName: string;
  cancelReasonKey?: string | null;
  cancelReasonText?: string | null;
  appPath: string;
};

export const NOTIFICATION_RETRY_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Backoff after attempt 1, 2, 3, 4+ (minutes). */
export const NOTIFICATION_RETRY_BACKOFF_MINUTES = [1, 5, 15, 30] as const;
