import "server-only";

import { getNotificationPreferences } from "@/lib/notifications/prefs";
import type { NotificationPrefRow } from "@/lib/notifications/prefs";
import { getTelegramStatus } from "@/lib/telegram/account";
import {
  telegramBotUsername,
  telegramConfigured,
} from "@/lib/telegram/config";
import type { PublicPortal } from "@/lib/portals";

export type NotificationPreferencesPayload = {
  preferences: NotificationPrefRow[];
  portal: PublicPortal;
  telegram: {
    connected: boolean;
    phoneConfirmed: boolean;
    hasPhone: boolean;
    configured: boolean;
    botUsername: string | null;
  };
};

/**
 * Shared preferences + Telegram status for RSC seed and GET preferences (#207 AD-2).
 * Authorization must be enforced by the caller.
 */
export async function getNotificationPreferencesPayload(
  userId: string,
  portal: PublicPortal,
): Promise<NotificationPreferencesPayload> {
  const [preferences, telegram] = await Promise.all([
    getNotificationPreferences(userId, portal),
    getTelegramStatus(userId),
  ]);
  return {
    preferences,
    portal,
    telegram: {
      connected: telegram.connected,
      phoneConfirmed: telegram.phoneConfirmed,
      hasPhone: telegram.hasPhone,
      configured: telegramConfigured(),
      botUsername: telegramBotUsername(),
    },
  };
}
