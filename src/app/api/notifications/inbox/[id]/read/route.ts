import { NextResponse } from "next/server";
import { markInAppNotificationRead } from "@/lib/notifications/inbox";
import { requirePortalUser } from "@/lib/portal-session.server";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const gate = await requirePortalUser();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const result = await markInAppNotificationRead({
    userId: gate.userId,
    id,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
