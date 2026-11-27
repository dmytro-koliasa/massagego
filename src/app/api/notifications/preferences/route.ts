import { NextResponse } from "next/server";
import { requirePortalUser } from "@/lib/portal-session.server";
import { saveNotificationPreferences } from "@/lib/notifications/prefs";
import type { PrefPatch } from "@/lib/notifications/prefs";
import { getNotificationPreferencesPayload } from "@/lib/notifications/preferences-payload";
import { parseWithSchema } from "@/lib/validation";
import { notificationPreferencesPatchSchema } from "@/lib/validation/notifications";

export async function GET() {
  const gate = await requirePortalUser();
  if (!gate.ok) return gate.response;

  const payload = await getNotificationPreferencesPayload(
    gate.userId,
    gate.portal,
  );
  return NextResponse.json(payload);
}

export async function PATCH(request: Request) {
  const gate = await requirePortalUser();
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = parseWithSchema(notificationPreferencesPatchSchema, body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await saveNotificationPreferences(
    gate.userId,
    gate.portal,
    parsed.data.preferences as PrefPatch[],
  );
  if (!result.ok) {
    const status =
      result.error === "critical_channel_required" ||
      result.error === "telegram_not_connected"
        ? 409
        : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ preferences: result.preferences });
}
