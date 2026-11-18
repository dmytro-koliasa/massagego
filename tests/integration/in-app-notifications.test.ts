/**
 * In-app inbox (BR-009): create, unread count, mark read, retention cleanup.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { completeClientData, completeMasseurData } from "./fixtures";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
}

const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

describeDb("in-app notifications inbox", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let createInAppNotification: typeof import("@/lib/notifications/inbox").createInAppNotification;
  let countUnreadInAppNotifications: typeof import("@/lib/notifications/inbox").countUnreadInAppNotifications;
  let markInAppNotificationRead: typeof import("@/lib/notifications/inbox").markInAppNotificationRead;
  let markAllInAppNotificationsRead: typeof import("@/lib/notifications/inbox").markAllInAppNotificationsRead;
  let deleteExpiredInAppNotifications: typeof import("@/lib/notifications/inbox").deleteExpiredInAppNotifications;
  let listInAppNotifications: typeof import("@/lib/notifications/inbox").listInAppNotifications;

  let masseurId = "";
  let clientId = "";
  let bookingId = "";

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    ({
      createInAppNotification,
      countUnreadInAppNotifications,
      markInAppNotificationRead,
      markAllInAppNotificationsRead,
      deleteExpiredInAppNotifications,
      listInAppNotifications,
    } = await import("@/lib/notifications/inbox"));

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const masseur = await prisma.user.create({
      data: completeMasseurData({
        email: `masseur-inbox-${suffix}@test.local`,
        phone: `+38050${String(Date.now()).slice(-7)}`,
      }),
    });
    const client = await prisma.user.create({
      data: completeClientData({
        email: `client-inbox-${suffix}@test.local`,
        phone: `+38067${String(Date.now()).slice(-7)}`,
      }),
    });
    masseurId = masseur.id;
    clientId = client.id;

    const slotStart = new Date();
    slotStart.setUTCDate(slotStart.getUTCDate() + 10);
    slotStart.setUTCHours(10, 0, 0, 0);
    const booking = await prisma.booking.create({
      data: {
        masseurId,
        clientUserId: clientId,
        clientName: "Inbox Client",
        clientPhone: "+380501111111",
        slotStart,
        status: "confirmed",
        massageType: "classic",
      },
    });
    bookingId = booking.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    if (bookingId) {
      await prisma.booking.deleteMany({ where: { id: bookingId } });
    }
    if (masseurId || clientId) {
      await prisma.user.deleteMany({
        where: { id: { in: [masseurId, clientId].filter(Boolean) } },
      });
    }
    await prisma.$disconnect();
  });

  it("creates inbox rows, tracks unread, marks read, and cleans expired", async () => {
    const payload = {
      locale: "en" as const,
      slotStartIso: new Date().toISOString(),
      timeZone: "Europe/Kyiv",
      timeZoneLabel: "Kyiv, UTC+2",
      massageType: "classic",
      otherPartyName: "Inbox Client",
      cancelReasonKey: null,
      cancelReasonText: null,
      appPath: "/masseur/dashboard",
    };

    const created = await createInAppNotification({
      recipientUserId: masseurId,
      bookingId,
      eventType: "booking_created",
      payload,
    });
    expect(created.id).toBeTruthy();

    await createInAppNotification({
      recipientUserId: masseurId,
      bookingId,
      eventType: "booking_cancelled_by_client",
      payload: {
        ...payload,
        cancelReasonKey: "changed_mind",
      },
    });

    expect(await countUnreadInAppNotifications(masseurId)).toBe(2);

    const listed = await listInAppNotifications({ userId: masseurId });
    expect(listed.items.length).toBeGreaterThanOrEqual(2);
    expect(listed.items[0]?.href).toBe("/masseur/dashboard");

    await markInAppNotificationRead({
      userId: masseurId,
      id: created.id,
    });
    expect(await countUnreadInAppNotifications(masseurId)).toBe(1);

    const all = await markAllInAppNotificationsRead({ userId: masseurId });
    expect(all.updated).toBeGreaterThanOrEqual(1);
    expect(await countUnreadInAppNotifications(masseurId)).toBe(0);

    await prisma.inAppNotification.updateMany({
      where: { userId: masseurId },
      data: {
        createdAt: new Date("2020-01-01T00:00:00.000Z"),
      },
    });
    const cleaned = await deleteExpiredInAppNotifications({
      now: new Date("2026-11-18T12:00:00.000Z"),
    });
    expect(cleaned.deleted).toBeGreaterThanOrEqual(2);
    expect(await countUnreadInAppNotifications(masseurId)).toBe(0);
  });
});
