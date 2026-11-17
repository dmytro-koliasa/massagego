import "server-only";
import {
  defaultEmailEnabled,
  eventsForPortal,
  isEmailLocked,
  validatePreferencePatches,
  type NotificationPrefRow,
  type PrefPatch,
} from "@/lib/notifications/pref-rules";
import type { NotificationEventType } from "@/lib/notifications/types";
import { prisma } from "@/lib/prisma";

export type { NotificationPrefRow, PrefPatch };
export {
  defaultEmailEnabled,
  eventsForPortal,
  isEmailLocked,
  validatePreferencePatches,
};

export async function getNotificationPreferences(
  userId: string,
  portal: "masseur" | "client",
): Promise<NotificationPrefRow[]> {
  const events = eventsForPortal(portal);
  const rows = await prisma.notificationPreference.findMany({
    where: { userId, eventType: { in: [...events] } },
    select: { eventType: true, emailEnabled: true },
  });
  const byEvent = new Map(
    rows.map((row) => [row.eventType as NotificationEventType, row.emailEnabled]),
  );

  return events.map((eventType) => {
    const stored = byEvent.get(eventType);
    const emailEnabled =
      stored === undefined ? defaultEmailEnabled(eventType) : stored;
    const locked = isEmailLocked(eventType);
    return {
      eventType,
      emailEnabled: locked ? true : emailEnabled,
      emailLocked: locked,
    };
  });
}

export async function isEmailNotificationEnabled(
  userId: string,
  eventType: NotificationEventType,
): Promise<boolean> {
  if (isEmailLocked(eventType)) return true;
  const row = await prisma.notificationPreference.findUnique({
    where: {
      userId_eventType: { userId, eventType },
    },
    select: { emailEnabled: true },
  });
  if (!row) return defaultEmailEnabled(eventType);
  return row.emailEnabled;
}

export async function saveNotificationPreferences(
  userId: string,
  portal: "masseur" | "client",
  patches: PrefPatch[],
): Promise<
  | { ok: true; preferences: NotificationPrefRow[] }
  | { ok: false; error: string }
> {
  const validated = validatePreferencePatches(portal, patches);
  if (!validated.ok) return validated;

  for (const patch of validated.patches) {
    await prisma.notificationPreference.upsert({
      where: {
        userId_eventType: { userId, eventType: patch.eventType },
      },
      create: {
        userId,
        eventType: patch.eventType,
        emailEnabled: patch.emailEnabled,
      },
      update: { emailEnabled: patch.emailEnabled },
    });
  }

  return {
    ok: true,
    preferences: await getNotificationPreferences(userId, portal),
  };
}
