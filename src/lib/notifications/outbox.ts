import "server-only";
import { sendEmail } from "@/lib/email/sender";
import { isSyntheticClientEmail } from "@/lib/email/verification";
import { isEmailNotificationEnabled } from "@/lib/notifications/prefs";
import { isPastRetryWindow, nextRetryAt } from "@/lib/notifications/retry";
import { renderNotificationEmail } from "@/lib/notifications/templates";
import type {
  NotificationEventType,
  NotificationPayload,
} from "@/lib/notifications/types";
import { prisma } from "@/lib/prisma";
import { formatTimeZoneOffsetLabel, normalizeTimeZone } from "@/lib/timezone";

function appOrigin(): string {
  return (
    process.env.AUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000"
  );
}

function displayName(
  user: {
    name?: string | null;
    nameEn?: string | null;
    nameUk?: string | null;
    email?: string | null;
  },
  locale: "en" | "uk",
): string {
  const localized =
    locale === "uk"
      ? user.nameUk?.trim() || user.nameEn?.trim()
      : user.nameEn?.trim() || user.nameUk?.trim();
  return localized || user.name?.trim() || user.email?.trim() || "User";
}

function truncateError(message: string): string {
  return message.slice(0, 500);
}

async function deliverOutboxRow(id: string): Promise<void> {
  const row = await prisma.notificationOutbox.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          email: true,
          emailVerified: true,
        },
      },
    },
  });
  if (!row) return;
  if (row.status === "sent" || row.status === "dead") return;

  const now = new Date();
  if (isPastRetryWindow(row.createdAt, now)) {
    await prisma.notificationOutbox.update({
      where: { id },
      data: {
        status: "dead",
        lastError: truncateError("max_retry_age"),
        nextAttemptAt: null,
      },
    });
    return;
  }

  let payload: NotificationPayload;
  try {
    payload = JSON.parse(row.payloadJson) as NotificationPayload;
  } catch {
    await prisma.notificationOutbox.update({
      where: { id },
      data: {
        status: "dead",
        lastError: truncateError("invalid_payload"),
        nextAttemptAt: null,
      },
    });
    return;
  }

  const email = row.user.email?.trim() ?? "";
  if (
    !row.user.emailVerified ||
    !email ||
    isSyntheticClientEmail(email)
  ) {
    await prisma.notificationOutbox.update({
      where: { id },
      data: {
        status: "dead",
        lastError: truncateError("recipient_email_unverified"),
        attemptCount: row.attemptCount + 1,
        nextAttemptAt: null,
      },
    });
    return;
  }

  const rendered = renderNotificationEmail(
    row.eventType as NotificationEventType,
    payload,
    appOrigin(),
  );
  const result = await sendEmail({
    to: email,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
  });

  if (result.ok) {
    await prisma.notificationOutbox.update({
      where: { id },
      data: {
        status: "sent",
        sentAt: now,
        attemptCount: row.attemptCount + 1,
        nextAttemptAt: null,
        lastError: null,
      },
    });
    return;
  }

  const attemptCount = row.attemptCount + 1;
  const retryAt = nextRetryAt(attemptCount, now);
  if (isPastRetryWindow(row.createdAt, retryAt)) {
    await prisma.notificationOutbox.update({
      where: { id },
      data: {
        status: "dead",
        attemptCount,
        lastError: truncateError(result.error),
        nextAttemptAt: null,
      },
    });
    return;
  }

  await prisma.notificationOutbox.update({
    where: { id },
    data: {
      status: "failed",
      attemptCount,
      lastError: truncateError(result.error),
      nextAttemptAt: retryAt,
    },
  });
}

export async function enqueueAndSendEmailNotification(options: {
  recipientUserId: string;
  bookingId: string;
  eventType: NotificationEventType;
  payload: NotificationPayload;
}): Promise<{ outboxId: string } | { skipped: string }> {
  const enabled = await isEmailNotificationEnabled(
    options.recipientUserId,
    options.eventType,
  );
  if (!enabled) {
    return { skipped: "pref_disabled" };
  }

  const recipient = await prisma.user.findUnique({
    where: { id: options.recipientUserId },
    select: { email: true, emailVerified: true },
  });
  if (
    !recipient?.emailVerified ||
    !recipient.email?.trim() ||
    isSyntheticClientEmail(recipient.email)
  ) {
    return { skipped: "unverified_email" };
  }

  const row = await prisma.notificationOutbox.create({
    data: {
      userId: options.recipientUserId,
      bookingId: options.bookingId,
      eventType: options.eventType,
      channel: "email",
      status: "pending",
      nextAttemptAt: new Date(),
      payloadJson: JSON.stringify(options.payload),
    },
    select: { id: true },
  });

  await deliverOutboxRow(row.id);
  return { outboxId: row.id };
}

export async function processNotificationOutbox(
  limit = 50,
): Promise<{ processed: number }> {
  const now = new Date();
  const due = await prisma.notificationOutbox.findMany({
    where: {
      status: { in: ["pending", "failed"] },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });

  for (const row of due) {
    await deliverOutboxRow(row.id);
  }
  return { processed: due.length };
}

type BookingNotifySource = {
  id: string;
  slotStart: Date | null;
  massageType: string | null;
  clientName: string;
  cancelReason?: string | null;
  cancelReasonText?: string | null;
  masseur: {
    id: string;
    name: string | null;
    nameEn: string | null;
    nameUk: string | null;
    email: string;
    timezone: string;
    preferredLocale: string;
  };
  client: {
    id: string;
    name: string | null;
    nameEn: string | null;
    nameUk: string | null;
    email: string;
    preferredLocale: string;
  } | null;
};

function bookingSelect() {
  return {
    id: true,
    slotStart: true,
    massageType: true,
    clientName: true,
    cancelReason: true,
    cancelReasonText: true,
    masseur: {
      select: {
        id: true,
        name: true,
        nameEn: true,
        nameUk: true,
        email: true,
        timezone: true,
        preferredLocale: true,
      },
    },
    client: {
      select: {
        id: true,
        name: true,
        nameEn: true,
        nameUk: true,
        email: true,
        preferredLocale: true,
      },
    },
  } as const;
}

async function loadBooking(bookingId: string): Promise<BookingNotifySource | null> {
  return prisma.booking.findUnique({
    where: { id: bookingId },
    select: bookingSelect(),
  });
}

function buildPayload(options: {
  booking: BookingNotifySource;
  recipientLocale: "en" | "uk";
  otherPartyName: string;
  appPath: string;
}): NotificationPayload {
  const slot = options.booking.slotStart ?? new Date();
  const timeZone = normalizeTimeZone(options.booking.masseur.timezone);
  return {
    locale: options.recipientLocale,
    slotStartIso: slot.toISOString(),
    timeZone,
    timeZoneLabel: formatTimeZoneOffsetLabel(timeZone, slot),
    massageType: options.booking.massageType,
    otherPartyName: options.otherPartyName,
    cancelReasonKey: options.booking.cancelReason ?? null,
    cancelReasonText: options.booking.cancelReasonText ?? null,
    appPath: options.appPath,
  };
}

/** Events 1 + 5 after a client booking create. Skips walk-ins (no client). */
export async function notifyBookingCreated(bookingId: string): Promise<void> {
  const booking = await loadBooking(bookingId);
  if (!booking?.client || !booking.slotStart) return;

  const masseurLocale =
    booking.masseur.preferredLocale === "uk" ? "uk" : "en";
  const clientLocale =
    booking.client.preferredLocale === "uk" ? "uk" : "en";

  await enqueueAndSendEmailNotification({
    recipientUserId: booking.masseur.id,
    bookingId: booking.id,
    eventType: "booking_created",
    payload: buildPayload({
      booking,
      recipientLocale: masseurLocale,
      otherPartyName: displayName(booking.client, masseurLocale),
      appPath: "/masseur/dashboard",
    }),
  });

  await enqueueAndSendEmailNotification({
    recipientUserId: booking.client.id,
    bookingId: booking.id,
    eventType: "booking_confirmed",
    payload: buildPayload({
      booking,
      recipientLocale: clientLocale,
      otherPartyName: displayName(booking.masseur, clientLocale),
      appPath: "/client",
    }),
  });
}

/** Event 2 — client cancelled. */
export async function notifyClientCancelledBooking(
  bookingId: string,
): Promise<void> {
  const booking = await loadBooking(bookingId);
  if (!booking?.client || !booking.slotStart) return;

  const masseurLocale =
    booking.masseur.preferredLocale === "uk" ? "uk" : "en";

  await enqueueAndSendEmailNotification({
    recipientUserId: booking.masseur.id,
    bookingId: booking.id,
    eventType: "booking_cancelled_by_client",
    payload: buildPayload({
      booking,
      recipientLocale: masseurLocale,
      otherPartyName: displayName(booking.client, masseurLocale),
      appPath: "/masseur/dashboard",
    }),
  });
}

/** Event 3 — masseur cancelled. */
export async function notifyMasseurCancelledBooking(
  bookingId: string,
): Promise<void> {
  const booking = await loadBooking(bookingId);
  if (!booking?.client || !booking.slotStart) return;

  const clientLocale =
    booking.client.preferredLocale === "uk" ? "uk" : "en";

  await enqueueAndSendEmailNotification({
    recipientUserId: booking.client.id,
    bookingId: booking.id,
    eventType: "booking_cancelled_by_masseur",
    payload: buildPayload({
      booking,
      recipientLocale: clientLocale,
      otherPartyName: displayName(booking.masseur, clientLocale),
      appPath: "/client",
    }),
  });
}

/**
 * Event 4 — auto-cancel when a client deletes their account.
 * Call site arrives in PR 14; exported now for the contract.
 */
export async function enqueueClientDeletedCancellationNotice(
  bookingId: string,
): Promise<void> {
  const booking = await loadBooking(bookingId);
  if (!booking?.slotStart) return;

  const masseurLocale =
    booking.masseur.preferredLocale === "uk" ? "uk" : "en";
  const otherName =
    (booking.client
      ? displayName(booking.client, masseurLocale)
      : booking.clientName.trim()) || "Client";

  await enqueueAndSendEmailNotification({
    recipientUserId: booking.masseur.id,
    bookingId: booking.id,
    eventType: "booking_cancelled_client_deleted",
    payload: buildPayload({
      booking: {
        ...booking,
        cancelReason: booking.cancelReason ?? "client_account_deleted",
      },
      recipientLocale: masseurLocale,
      otherPartyName: otherName,
      appPath: "/masseur/dashboard",
    }),
  });
}
