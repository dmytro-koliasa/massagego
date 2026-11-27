import { redirect } from "next/navigation";
import { auth } from "@/auth/client";
import { NotificationSettingsView } from "@/components/notification-settings-view";
import { listInAppNotifications } from "@/lib/notifications/inbox";
import { getNotificationPreferencesPayload } from "@/lib/notifications/preferences-payload";
import { portalHomePath } from "@/lib/portals";
import { userHasPortal } from "@/lib/portals.server";

export default async function ClientNotificationsPage() {
  const session = await auth();
  const loginPath = portalHomePath("client");
  if (!session?.user?.id || session.user.portal !== "client") {
    redirect(loginPath);
  }

  const allowed = await userHasPortal(session.user.id, "client");
  if (!allowed) {
    redirect(loginPath);
  }

  const [preferencesPayload, inbox] = await Promise.all([
    getNotificationPreferencesPayload(session.user.id, "client"),
    listInAppNotifications({ userId: session.user.id }),
  ]);

  return (
    <NotificationSettingsView
      backHref="/client"
      portal="client"
      initialPreferences={{
        preferences: preferencesPayload.preferences,
        telegram: preferencesPayload.telegram,
      }}
      initialInbox={inbox}
    />
  );
}
