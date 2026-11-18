import { NextResponse } from "next/server";
import { countUnreadInAppNotifications } from "@/lib/notifications/inbox";
import { requirePortalUser } from "@/lib/notifications/portal-gate";

export async function GET() {
  const gate = await requirePortalUser();
  if (!gate.ok) return gate.response;

  const count = await countUnreadInAppNotifications(gate.userId);
  return NextResponse.json({ count });
}
