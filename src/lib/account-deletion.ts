import "server-only";
import {
  lockClientBookings,
  lockMasseurBookings,
} from "@/lib/booking-conflict";
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

class DeletionAbort extends Error {
  readonly result: Extract<DeleteAccountResult, { ok: false }>;
  constructor(result: Extract<DeleteAccountResult, { ok: false }>) {
    super(result.error);
    this.result = result;
  }
}

export async function countMasseurFutureBookings(
  masseurId: string,
  now = new Date(),
): Promise<number> {
  return prisma.booking.count({
    where: {
      masseurId,
      status: "confirmed",
      slotStart: { gt: now },
    },
  });
}

async function collectUploadUrls(
  userId: string,
  portal: string,
): Promise<{ urls: string[]; galleryIds: string[] }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      image: true,
      galleryImages: { select: { id: true, url: true } },
    },
  });
  if (!user) return { urls: [], galleryIds: [] };

  const urls: string[] = [];
  if (user.image) urls.push(user.image);
  const galleryIds: string[] = [];
  for (const image of user.galleryImages) {
    urls.push(image.url);
    galleryIds.push(image.id);
  }
  if (portal !== "masseur") {
    return { urls, galleryIds: [] };
  }
  return { urls, galleryIds };
}

/**
 * Best-effort blob/file cleanup after the account row is anonymised (#83).
 * Failures are logged; privacy state is already consistent in the DB.
 */
async function deleteUploadUrls(urls: string[]): Promise<void> {
  for (const url of urls) {
    try {
      await deleteUpload(url);
    } catch (error) {
      console.error("[account-deletion] upload cleanup failed", error);
    }
  }
}

/**
 * Self-service account deletion (BR-011 / #83): anonymise User under the same
 * advisory locks as booking writes so concurrent book+delete cannot leave an
 * active booking on a deleted masseur. Upload blobs are removed after commit.
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

  const uploads = await collectUploadUrls(user.id, options.portal);
  let cancelledIds: string[] = [];
  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        { id: string; deletedAt: Date | null }[]
      >`SELECT id, "deletedAt" FROM "User" WHERE id = ${user.id} FOR UPDATE`;
      const row = locked[0];
      if (!row) {
        throw new DeletionAbort({ ok: false, error: "not_found" });
      }
      if (row.deletedAt) {
        throw new DeletionAbort({ ok: false, error: "already_deleted" });
      }

      if (options.portal === "masseur") {
        // Same lock booking create takes (#83) — serialise with concurrent books.
        await lockMasseurBookings(tx, user.id);
        const futureBookingCount = await tx.booking.count({
          where: {
            masseurId: user.id,
            status: "confirmed",
            slotStart: { gt: now },
          },
        });
        if (futureBookingCount > 0) {
          throw new DeletionAbort({
            ok: false,
            error: "masseur_has_future_bookings",
            futureBookingCount,
          });
        }
      }

      if (options.portal === "client") {
        await lockClientBookings(tx, user.id);
        const future = await tx.booking.findMany({
          where: {
            clientUserId: user.id,
            status: "confirmed",
            slotStart: { gt: now },
          },
          select: { id: true },
        });
        if (future.length > 0) {
          const claimed = await tx.booking.updateMany({
            where: {
              id: { in: future.map((b) => b.id) },
              status: "confirmed",
            },
            data: {
              status: "cancelled",
              cancelledBy: "client",
              cancelledAt: now,
              cancelReason: "client_account_deleted",
              cancelReasonText: null,
            },
          });
          if (claimed.count > 0) {
            const won = await tx.booking.findMany({
              where: {
                id: { in: future.map((b) => b.id) },
                status: "cancelled",
                cancelledBy: "client",
                cancelledAt: now,
              },
              select: { id: true },
            });
            cancelledIds = won.map((b) => b.id);
          }
        }
      }

      if (uploads.galleryIds.length > 0) {
        await tx.galleryImage.deleteMany({
          where: { id: { in: uploads.galleryIds } },
        });
      }

      await tx.session.deleteMany({ where: { userId: user.id } });
      await tx.account.deleteMany({ where: { userId: user.id } });
      await tx.notificationPreference.deleteMany({ where: { userId: user.id } });
      await tx.notificationOutbox.deleteMany({ where: { userId: user.id } });
      await tx.inAppNotification.deleteMany({ where: { userId: user.id } });
      await tx.verificationToken.deleteMany({
        where: {
          OR: [
            { identifier: `email-verify:${user.id}` },
            { identifier: `password-reset:${user.id}` },
            { identifier: `telegram-link:${user.id}` },
          ],
        },
      });

      if (options.portal === "client") {
        await tx.booking.updateMany({
          where: { clientUserId: user.id },
          data: {
            clientName: DELETED_USER_NAME_KEY,
            clientPhone: "",
          },
        });
      }

      await tx.user.update({
        where: { id: user.id },
        data: {
          deletedAt: now,
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
      });
    });
  } catch (error) {
    if (error instanceof DeletionAbort) {
      return error.result;
    }
    throw error;
  }

  await deleteUploadUrls(uploads.urls);

  for (const bookingId of cancelledIds) {
    try {
      await enqueueClientDeletedCancellationNotice(bookingId);
    } catch {
      console.error("[account-deletion] notify failed", bookingId);
    }
  }

  return { ok: true };
}
