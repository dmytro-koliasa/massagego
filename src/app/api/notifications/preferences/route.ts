import { NextResponse } from "next/server";
import { requirePortalUser } from "@/lib/portal-session.server";
import {
  getNotificationPreferences,
  saveNotificationPreferences,
} from "@/lib/notifications/prefs";
import type { PrefPatch } from "@/lib/notifications/prefs";
import { getTelegramStatus } from "@/lib/telegram/account";
import {
  telegramBotUsername,
  telegramConfigured,
} from "@/lib/telegram/config";
import { parseWithSchema } from "@/lib/validation";
import { notificationPreferencesPatchSchema } from "@/lib/validation/notifications";

export async function GET() {
  const gate = await requirePortalUser();
  if (!gate.ok) return gate.response;

  const [preferences, telegram] = await Promise.all([
    getNotificationPreferences(gate.userId, gate.portal),
    getTelegramStatus(gate.userId),
  ]);
  return NextResponse.json({
    preferences,
    portal: gate.portal,
    telegram: {
      ...telegram,
      configured: telegramConfigured(),
      botUsername: telegramBotUsername(),
    },
  });
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
