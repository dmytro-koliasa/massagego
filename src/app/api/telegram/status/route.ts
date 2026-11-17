import { NextResponse } from "next/server";
import { requirePortalUser } from "@/lib/notifications/portal-gate";
import { getTelegramStatus } from "@/lib/telegram/account";
import {
  telegramBotUsername,
  telegramConfigured,
} from "@/lib/telegram/config";

export async function GET() {
  const gate = await requirePortalUser();
  if (!gate.ok) return gate.response;

  const status = await getTelegramStatus(gate.userId);
  return NextResponse.json({
    ...status,
    configured: telegramConfigured(),
    botUsername: telegramBotUsername(),
  });
}
