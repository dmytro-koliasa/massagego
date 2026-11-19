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
  telegramEnabled: boolean;
  telegramLocked: boolean;
};

export type PrefPatch = {
  eventType: NotificationEventType;
  emailEnabled?: boolean;
  telegramEnabled?: boolean;
};

export type PrefChannelState = {
  emailEnabled: boolean;
  telegramEnabled: boolean;
};

export function defaultEmailEnabled(
  eventType: NotificationEventType,
): boolean {
  void eventType;
  return true;
}

export function defaultTelegramEnabled(
  eventType: NotificationEventType,
): boolean {
  void eventType;
  return true;
}

export function isCriticalEvent(eventType: NotificationEventType): boolean {
  return CRITICAL_NOTIFICATION_EVENTS.has(eventType);
}

/**
 * Critical email cannot be turned off unless Telegram is connected and on
 * for that event (BR-009 ≥1 channel).
 */
export function isEmailLocked(
  eventType: NotificationEventType,
  options?: {
    telegramConnected: boolean;
    telegramEnabled: boolean;
  },
): boolean {
  if (!isCriticalEvent(eventType)) return false;
  if (!options?.telegramConnected) return true;
  return !options.telegramEnabled;
}

/**
 * Telegram toggles are inactive until linked; critical Telegram cannot be
 * turned off unless email stays on.
 */
export function isTelegramLocked(
  eventType: NotificationEventType,
  options: {
    telegramConnected: boolean;
    emailEnabled: boolean;
  },
): boolean {
  if (!options.telegramConnected) return true;
  if (!isCriticalEvent(eventType)) return false;
  return !options.emailEnabled;
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
  context: {
    telegramConnected: boolean;
    current: Record<string, PrefChannelState>;
  },
): { ok: true; patches: PrefPatch[] } | { ok: false; error: string } {
  const allowed = new Set(eventsForPortal(portal));
  const normalized: PrefPatch[] = [];
  const working: Record<string, PrefChannelState> = { ...context.current };

  for (const patch of patches) {
    if (!NOTIFICATION_EVENT_TYPES.includes(patch.eventType)) {
      return { ok: false, error: "invalid_event" };
    }
    if (!allowed.has(patch.eventType)) {
      return { ok: false, error: "event_not_for_portal" };
    }
    if (
      patch.emailEnabled === undefined &&
      patch.telegramEnabled === undefined
    ) {
      return { ok: false, error: "empty_patch" };
    }

    const prev = working[patch.eventType] ?? {
      emailEnabled: defaultEmailEnabled(patch.eventType),
      telegramEnabled: defaultTelegramEnabled(patch.eventType),
    };
    const next: PrefChannelState = {
      emailEnabled:
        patch.emailEnabled === undefined
          ? prev.emailEnabled
          : Boolean(patch.emailEnabled),
      telegramEnabled:
        patch.telegramEnabled === undefined
          ? prev.telegramEnabled
          : Boolean(patch.telegramEnabled),
    };

    if (!context.telegramConnected && patch.telegramEnabled !== undefined) {
      return { ok: false, error: "telegram_not_connected" };
    }

    if (
      isCriticalEvent(patch.eventType) &&
      !next.emailEnabled &&
      !(context.telegramConnected && next.telegramEnabled)
    ) {
      return { ok: false, error: "critical_channel_required" };
    }

    working[patch.eventType] = next;
    normalized.push({
      eventType: patch.eventType,
      ...(patch.emailEnabled !== undefined
        ? { emailEnabled: next.emailEnabled }
        : {}),
      ...(patch.telegramEnabled !== undefined
        ? { telegramEnabled: next.telegramEnabled }
        : {}),
    });
  }

  return { ok: true, patches: normalized };
}
