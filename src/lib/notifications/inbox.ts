import "server-only";
import { IN_APP_NOTIFICATION_PAGE_SIZE } from "@/lib/booking-constants";
import { inAppRetentionCutoff } from "@/lib/notifications/inbox-rules";
import {
  inAppNotificationHref,
  renderInAppNotification,
} from "@/lib/notifications/templates";
import type {
  NotificationEventType,
  NotificationPayload,
} from "@/lib/notifications/types";
import { prisma } from "@/lib/prisma";

export { inAppRetentionCutoff } from "@/lib/notifications/inbox-rules";

export type InAppNotificationItem = {
  id: string;
  eventType: NotificationEventType;
  title: string;
  body: string;
  href: string;
  readAt: string | null;
  createdAt: string;
  bookingId: string | null;
};

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

/** Always write an inbox row (independent of email/Telegram prefs). */
export async function createInAppNotification(options: {
  recipientUserId: string;
  bookingId: string;
  eventType: NotificationEventType;
  payload: NotificationPayload;
}): Promise<{ id: string }> {
  const rendered = renderInAppNotification(
    options.eventType,
    options.payload,
  );
  const row = await prisma.inAppNotification.create({
    data: {
      userId: options.recipientUserId,
      bookingId: options.bookingId,
      eventType: options.eventType,
      title: truncate(rendered.title, 200),
      body: truncate(rendered.body, 1000),
      href: inAppNotificationHref(options.eventType),
    },
    select: { id: true },
  });
  return row;
}

export async function listInAppNotifications(options: {
  userId: string;
  limit?: number;
  cursor?: string | null;
  now?: Date;
}): Promise<{ items: InAppNotificationItem[]; nextCursor: string | null }> {
  const limit = options.limit ?? IN_APP_NOTIFICATION_PAGE_SIZE;
  const cutoff = inAppRetentionCutoff(options.now);
  const take = Math.min(Math.max(limit, 1), 50) + 1;

  const rows = await prisma.inAppNotification.findMany({
    where: {
      userId: options.userId,
      createdAt: { gte: cutoff },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    ...(options.cursor
      ? {
          cursor: { id: options.cursor },
          skip: 1,
        }
      : {}),
    select: {
      id: true,
      eventType: true,
      title: true,
      body: true,
      href: true,
      readAt: true,
      createdAt: true,
      bookingId: true,
    },
  });

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  return {
    items: slice.map((row) => ({
      id: row.id,
      eventType: row.eventType as NotificationEventType,
      title: row.title,
      body: row.body,
      href: row.href,
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      bookingId: row.bookingId,
    })),
    nextCursor: hasMore ? (slice[slice.length - 1]?.id ?? null) : null,
  };
}

export async function countUnreadInAppNotifications(
  userId: string,
  now = new Date(),
): Promise<number> {
  const cutoff = inAppRetentionCutoff(now);
  return prisma.inAppNotification.count({
    where: {
      userId,
      readAt: null,
      createdAt: { gte: cutoff },
    },
  });
}

export async function markInAppNotificationRead(options: {
  userId: string;
  id: string;
  now?: Date;
}): Promise<{ ok: true } | { ok: false; error: "not_found" }> {
  const now = options.now ?? new Date();
  const result = await prisma.inAppNotification.updateMany({
    where: { id: options.id, userId: options.userId, readAt: null },
    data: { readAt: now },
  });
  if (result.count === 0) {
    const exists = await prisma.inAppNotification.findFirst({
      where: { id: options.id, userId: options.userId },
      select: { id: true, readAt: true },
    });
    if (!exists) return { ok: false, error: "not_found" };
  }
  return { ok: true };
}

export async function markAllInAppNotificationsRead(options: {
  userId: string;
  now?: Date;
}): Promise<{ updated: number }> {
  const now = options.now ?? new Date();
  const cutoff = inAppRetentionCutoff(now);
  const result = await prisma.inAppNotification.updateMany({
    where: {
      userId: options.userId,
      readAt: null,
      createdAt: { gte: cutoff },
    },
    data: { readAt: now },
  });
  return { updated: result.count };
}

export async function deleteExpiredInAppNotifications(options?: {
  now?: Date;
  limit?: number;
}): Promise<{ deleted: number }> {
  const now = options?.now ?? new Date();
  const limit = options?.limit ?? 500;
  const cutoff = inAppRetentionCutoff(now);
  const expired = await prisma.inAppNotification.findMany({
    where: { createdAt: { lt: cutoff } },
    select: { id: true },
    take: limit,
    orderBy: { createdAt: "asc" },
  });
  if (expired.length === 0) return { deleted: 0 };
  const result = await prisma.inAppNotification.deleteMany({
    where: { id: { in: expired.map((row) => row.id) } },
  });
  return { deleted: result.count };
}
