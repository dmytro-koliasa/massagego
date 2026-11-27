import { redirect } from "next/navigation";
import { auth } from "@/auth/masseur";
import { NotificationSettingsView } from "@/components/notification-settings-view";
import { listInAppNotifications } from "@/lib/notifications/inbox";
import { getNotificationPreferencesPayload } from "@/lib/notifications/preferences-payload";
import { portalHomePath } from "@/lib/portals";
import { userHasPortal } from "@/lib/portals.server";

export default async function MasseurNotificationsPage() {
  const session = await auth();
  const loginPath = portalHomePath("masseur");
  if (!session?.user?.id || session.user.portal !== "masseur") {
    redirect(loginPath);
  }

  const allowed = await userHasPortal(session.user.id, "masseur");
  if (!allowed) {
    redirect(loginPath);
  }

  const [preferencesPayload, inbox] = await Promise.all([
    getNotificationPreferencesPayload(session.user.id, "masseur"),
    listInAppNotifications({ userId: session.user.id }),
  ]);

  return (
    <NotificationSettingsView
      backHref="/masseur/dashboard"
      portal="masseur"
      initialPreferences={{
        preferences: preferencesPayload.preferences,
        telegram: preferencesPayload.telegram,
      }}
      initialInbox={inbox}
    />
  );
}
