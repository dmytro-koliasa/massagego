import { redirect } from "next/navigation";
import { auth } from "@/auth/client";
import { NotificationSettingsView } from "@/components/notification-settings-view";
import { portalHomePath } from "@/lib/portals";

export default async function ClientNotificationsPage() {
  const session = await auth();
  if (!session?.user?.id || session.user.portal !== "client") {
    redirect(portalHomePath("client"));
  }

  return <NotificationSettingsView backHref="/client" portal="client" />;
}
