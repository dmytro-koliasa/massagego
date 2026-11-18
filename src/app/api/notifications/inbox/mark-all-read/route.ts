import { NextResponse } from "next/server";
import { markAllInAppNotificationsRead } from "@/lib/notifications/inbox";
import { requirePortalUser } from "@/lib/notifications/portal-gate";

export async function POST() {
  const gate = await requirePortalUser();
  if (!gate.ok) return gate.response;

  const result = await markAllInAppNotificationsRead({ userId: gate.userId });
  return NextResponse.json(result);
}
