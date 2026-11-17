import "server-only";
import {
  anonymisedEmailFor,
  DELETED_USER_NAME_KEY,
} from "@/lib/deleted-user";
import { enqueueClientDeletedCancellationNotice } from "@/lib/notifications/outbox";
import { prisma } from "@/lib/prisma";
import { deleteUpload } from "@/lib/uploads";

export type DeleteAccountResult =
  | { ok: true }
  | {
      ok: false;
      error: "already_deleted" | "masseur_has_future_bookings" | "not_found";
      futureBookingCount?: number;
    };

export async function countMasseurFutureBookings(
  masseurId: string,
): Promise<number> {
  const now = new Date();
  return prisma.booking.count({
    where: {
      masseurId,
      status: "confirmed",
      slotStart: { gt: now },
    },
  });
}

async function cancelClientFutureBookings(clientUserId: string): Promise<string[]> {
  const now = new Date();
  const future = await prisma.booking.findMany({
    where: {
      clientUserId,
      status: "confirmed",
      slotStart: { gt: now },
    },
    select: { id: true },
  });

  const ids: string[] = [];
  for (const booking of future) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: "cancelled",
        cancelledBy: "client",
        cancelledAt: now,
        cancelReason: "client_account_deleted",
        cancelReasonText: null,
      },
    });
    ids.push(booking.id);
  }
  return ids;
}

async function collectAndDeleteUploads(userId: string, portal: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      image: true,
      galleryImages: { select: { id: true, url: true } },
    },
  });
  if (!user) return;

  const urls: string[] = [];
  if (user.image) urls.push(user.image);
  for (const image of user.galleryImages) {
    urls.push(image.url);
  }

  if (portal === "masseur" && user.galleryImages.length > 0) {
    await prisma.galleryImage.deleteMany({ where: { masseurId: userId } });
  }

  for (const url of urls) {
    await deleteUpload(url);
  }
}

/**
 * Self-service account deletion (BR-011): anonymise User, wipe credentials,
 * cancel client future bookings + notify, free phone/email for re-registration.
 */
export async function deleteOwnAccount(options: {
  userId: string;
  portal: "client" | "masseur";
}): Promise<DeleteAccountResult> {
  const user = await prisma.user.findFirst({
    where: { id: options.userId, portal: options.portal },
    select: { id: true, deletedAt: true, portal: true },
  });
  if (!user) return { ok: false, error: "not_found" };
  if (user.deletedAt) return { ok: false, error: "already_deleted" };

  if (options.portal === "masseur") {
    const futureBookingCount = await countMasseurFutureBookings(user.id);
    if (futureBookingCount > 0) {
      return {
        ok: false,
        error: "masseur_has_future_bookings",
        futureBookingCount,
      };
    }
  }

  let cancelledIds: string[] = [];
  if (options.portal === "client") {
    cancelledIds = await cancelClientFutureBookings(user.id);
  }

  await collectAndDeleteUploads(user.id, options.portal);

  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId: user.id } }),
    prisma.account.deleteMany({ where: { userId: user.id } }),
    prisma.notificationPreference.deleteMany({ where: { userId: user.id } }),
    prisma.notificationOutbox.deleteMany({ where: { userId: user.id } }),
    prisma.verificationToken.deleteMany({
      where: {
        OR: [
          { identifier: `email-verify:${user.id}` },
          { identifier: `password-reset:${user.id}` },
          { identifier: `telegram-link:${user.id}` },
        ],
      },
    }),
    ...(options.portal === "client"
      ? [
          prisma.booking.updateMany({
            where: { clientUserId: user.id },
            data: {
              clientName: DELETED_USER_NAME_KEY,
              clientPhone: "",
            },
          }),
        ]
      : []),
    prisma.user.update({
      where: { id: user.id },
      data: {
        deletedAt: new Date(),
        name: null,
        nameEn: null,
        nameUk: null,
        slug: null,
        email: anonymisedEmailFor(user.id),
        emailVerified: null,
        phone: null,
        image: null,
        descriptionEn: null,
        descriptionUk: null,
        massageTypes: "[]",
        city: null,
        cityPlaceId: null,
        cityCountryCode: null,
        cityNameEn: null,
        cityNameUk: null,
        cityLat: null,
        cityLon: null,
        address: null,
        passwordHash: null,
        telegramChatId: null,
        telegramLinkedAt: null,
        telegramAwaitingPhoneConfirm: false,
        phoneConfirmedAt: null,
        emailVerifyLastSentAt: null,
        emailVerifySendWindowStart: null,
        emailVerifySendCount: 0,
      },
    }),
  ]);

  for (const bookingId of cancelledIds) {
    try {
      await enqueueClientDeletedCancellationNotice(bookingId);
    } catch (error) {
      console.error("[account-deletion] notify failed", bookingId);
    }
  }

  return { ok: true };
}
