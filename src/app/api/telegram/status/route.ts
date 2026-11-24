import { NextResponse } from "next/server";
import { requirePortalUser } from "@/lib/portal-session.server";
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
