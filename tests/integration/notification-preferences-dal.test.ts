/**
 * #207 AD-2: preferences payload used by RSC seed matches GET route shape.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { completeClientData } from "./fixtures";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
}

const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

describeDb("notification preferences DAL (#207)", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let getNotificationPreferencesPayload: typeof import("@/lib/notifications/preferences-payload").getNotificationPreferencesPayload;
  let listInAppNotifications: typeof import("@/lib/notifications/inbox").listInAppNotifications;

  let clientId = "";

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    ({ getNotificationPreferencesPayload } = await import(
      "@/lib/notifications/preferences-payload"
    ));
    ({ listInAppNotifications } = await import(
      "@/lib/notifications/inbox"
    ));

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const client = await prisma.user.create({
      data: completeClientData({
        email: `client-prefs-${suffix}@test.local`,
        phone: `+38067${String(Date.now()).slice(-7)}`,
      }),
    });
    clientId = client.id;
  });

  afterAll(async () => {
    if (!clientId) return;
    await prisma.notificationPreference.deleteMany({
      where: { userId: clientId },
    });
    await prisma.user.delete({ where: { id: clientId } });
  });

  it("returns serializable preferences payload for portal seed/API", async () => {
    const a = await getNotificationPreferencesPayload(clientId, "client");
    const b = await getNotificationPreferencesPayload(clientId, "client");
    expect(a.portal).toBe("client");
    expect(a.preferences.length).toBeGreaterThan(0);
    expect(a.telegram).toMatchObject({
      connected: expect.any(Boolean),
      configured: expect.any(Boolean),
    });
    expect(a).toEqual(b);
  });

  it("inbox list is stable empty seed for new user", async () => {
    const a = await listInAppNotifications({ userId: clientId });
    const b = await listInAppNotifications({ userId: clientId });
    expect(a).toEqual(b);
    expect(a.items).toEqual([]);
  });
});
