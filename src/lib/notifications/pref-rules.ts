import type { NotificationEventType } from "@/lib/notifications/types";
import {
  CRITICAL_NOTIFICATION_EVENTS,
  NOTIFICATION_EVENT_TYPES,
  NOTIFICATION_EVENT_RECIPIENT_PORTAL,
} from "@/lib/notifications/types";

export type NotificationPrefRow = {
  eventType: NotificationEventType;
  emailEnabled: boolean;
  emailLocked: boolean;
};

export type PrefPatch = {
  eventType: NotificationEventType;
  emailEnabled: boolean;
};

export function defaultEmailEnabled(
  _eventType: NotificationEventType,
): boolean {
  return true;
}

export function isEmailLocked(eventType: NotificationEventType): boolean {
  // Until Telegram (PR 13), critical events cannot turn email off.
  return CRITICAL_NOTIFICATION_EVENTS.has(eventType);
}

export function eventsForPortal(
  portal: "masseur" | "client",
): NotificationEventType[] {
  return NOTIFICATION_EVENT_TYPES.filter(
    (event) => NOTIFICATION_EVENT_RECIPIENT_PORTAL[event] === portal,
  );
}

export function validatePreferencePatches(
  portal: "masseur" | "client",
  patches: PrefPatch[],
): { ok: true; patches: PrefPatch[] } | { ok: false; error: string } {
  const allowed = new Set(eventsForPortal(portal));
  const normalized: PrefPatch[] = [];

  for (const patch of patches) {
    if (!NOTIFICATION_EVENT_TYPES.includes(patch.eventType)) {
      return { ok: false, error: "invalid_event" };
    }
    if (!allowed.has(patch.eventType)) {
      return { ok: false, error: "event_not_for_portal" };
    }
    if (isEmailLocked(patch.eventType) && patch.emailEnabled === false) {
      return { ok: false, error: "critical_email_required" };
    }
    normalized.push({
      eventType: patch.eventType,
      emailEnabled: Boolean(patch.emailEnabled),
    });
  }

  return { ok: true, patches: normalized };
}
