import { redirect } from "next/navigation";
import { auth } from "@/auth/masseur";
import { NotificationSettingsView } from "@/components/notification-settings-view";
import { portalHomePath } from "@/lib/portals";

export default async function MasseurNotificationsPage() {
  const session = await auth();
  if (!session?.user?.id || session.user.portal !== "masseur") {
    redirect(portalHomePath("masseur"));
  }

  return (
    <NotificationSettingsView backHref="/masseur/dashboard" portal="masseur" />
  );
}
