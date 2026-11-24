import { NextResponse } from "next/server";
import { IN_APP_NOTIFICATION_PAGE_SIZE } from "@/lib/booking-constants";
import { listInAppNotifications } from "@/lib/notifications/inbox";
import { requirePortalUser } from "@/lib/portal-session.server";

export async function GET(request: Request) {
  const gate = await requirePortalUser();
  if (!gate.ok) return gate.response;

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw
    ? Number.parseInt(limitRaw, 10)
    : IN_APP_NOTIFICATION_PAGE_SIZE;

  const result = await listInAppNotifications({
    userId: gate.userId,
    cursor,
    limit: Number.isFinite(limit) ? limit : IN_APP_NOTIFICATION_PAGE_SIZE,
  });

  return NextResponse.json(result);
}
