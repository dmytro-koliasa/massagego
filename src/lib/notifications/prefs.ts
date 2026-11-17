import "server-only";
import {
  defaultEmailEnabled,
  defaultTelegramEnabled,
  eventsForPortal,
  isEmailLocked,
  isTelegramLocked,
  validatePreferencePatches,
  type NotificationPrefRow,
  type PrefChannelState,
  type PrefPatch,
} from "@/lib/notifications/pref-rules";
import type { NotificationEventType } from "@/lib/notifications/types";
import { prisma } from "@/lib/prisma";

export type { NotificationPrefRow, PrefPatch };
export {
  defaultEmailEnabled,
  defaultTelegramEnabled,
  eventsForPortal,
  isEmailLocked,
  isTelegramLocked,
  validatePreferencePatches,
};

async function isTelegramConnected(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { telegramChatId: true },
  });
  return Boolean(user?.telegramChatId);
}

export async function getNotificationPreferences(
  userId: string,
  portal: "masseur" | "client",
): Promise<NotificationPrefRow[]> {
  const events = eventsForPortal(portal);
  const telegramConnected = await isTelegramConnected(userId);
  const rows = await prisma.notificationPreference.findMany({
    where: { userId, eventType: { in: [...events] } },
    select: {
      eventType: true,
      emailEnabled: true,
      telegramEnabled: true,
    },
  });
  const byEvent = new Map(
    rows.map((row) => [
      row.eventType as NotificationEventType,
      {
        emailEnabled: row.emailEnabled,
        telegramEnabled: row.telegramEnabled,
      },
    ]),
  );

  return events.map((eventType) => {
    const stored = byEvent.get(eventType);
    const emailEnabled =
      stored?.emailEnabled === undefined
        ? defaultEmailEnabled(eventType)
        : stored.emailEnabled;
    const telegramEnabledRaw =
      stored?.telegramEnabled === undefined
        ? defaultTelegramEnabled(eventType)
        : stored.telegramEnabled;
    const telegramEnabled = telegramConnected ? telegramEnabledRaw : false;
    const emailLocked = isEmailLocked(eventType, {
      telegramConnected,
      telegramEnabled,
    });
    const telegramLocked = isTelegramLocked(eventType, {
      telegramConnected,
      emailEnabled: emailLocked ? true : emailEnabled,
    });
    return {
      eventType,
      emailEnabled: emailLocked ? true : emailEnabled,
      emailLocked,
      telegramEnabled,
      telegramLocked,
    };
  });
}

export async function isEmailNotificationEnabled(
  userId: string,
  eventType: NotificationEventType,
): Promise<boolean> {
  const telegramConnected = await isTelegramConnected(userId);
  const row = await prisma.notificationPreference.findUnique({
    where: {
      userId_eventType: { userId, eventType },
    },
    select: { emailEnabled: true, telegramEnabled: true },
  });
  const telegramEnabled = telegramConnected
    ? (row?.telegramEnabled ?? defaultTelegramEnabled(eventType))
    : false;
  if (
    isEmailLocked(eventType, {
      telegramConnected,
      telegramEnabled,
    })
  ) {
    return true;
  }
  if (!row) return defaultEmailEnabled(eventType);
  return row.emailEnabled;
}

export async function isTelegramNotificationEnabled(
  userId: string,
  eventType: NotificationEventType,
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { telegramChatId: true },
  });
  if (!user?.telegramChatId) return false;

  const row = await prisma.notificationPreference.findUnique({
    where: {
      userId_eventType: { userId, eventType },
    },
    select: { emailEnabled: true, telegramEnabled: true },
  });
  const emailEnabled = row?.emailEnabled ?? defaultEmailEnabled(eventType);
  const telegramEnabled =
    row?.telegramEnabled ?? defaultTelegramEnabled(eventType);
  if (
    isTelegramLocked(eventType, {
      telegramConnected: true,
      emailEnabled,
    })
  ) {
    return true;
  }
  return telegramEnabled;
}

export async function saveNotificationPreferences(
  userId: string,
  portal: "masseur" | "client",
  patches: PrefPatch[],
): Promise<
  | { ok: true; preferences: NotificationPrefRow[] }
  | { ok: false; error: string }
> {
  const telegramConnected = await isTelegramConnected(userId);
  const currentRows = await getNotificationPreferences(userId, portal);
  const current: Record<string, PrefChannelState> = {};
  for (const row of currentRows) {
    current[row.eventType] = {
      emailEnabled: row.emailEnabled,
      telegramEnabled: row.telegramEnabled,
    };
  }

  const validated = validatePreferencePatches(portal, patches, {
    telegramConnected,
    current,
  });
  if (!validated.ok) return validated;

  for (const patch of validated.patches) {
    const existing = await prisma.notificationPreference.findUnique({
      where: {
        userId_eventType: { userId, eventType: patch.eventType },
      },
      select: { emailEnabled: true, telegramEnabled: true },
    });
    const emailEnabled =
      patch.emailEnabled ??
      existing?.emailEnabled ??
      defaultEmailEnabled(patch.eventType);
    const telegramEnabled =
      patch.telegramEnabled ??
      existing?.telegramEnabled ??
      defaultTelegramEnabled(patch.eventType);

    await prisma.notificationPreference.upsert({
      where: {
        userId_eventType: { userId, eventType: patch.eventType },
      },
      create: {
        userId,
        eventType: patch.eventType,
        emailEnabled,
        telegramEnabled,
      },
      update: {
        ...(patch.emailEnabled !== undefined
          ? { emailEnabled: patch.emailEnabled }
          : {}),
        ...(patch.telegramEnabled !== undefined
          ? { telegramEnabled: patch.telegramEnabled }
          : {}),
      },
    });
  }

  return {
    ok: true,
    preferences: await getNotificationPreferences(userId, portal),
  };
}
