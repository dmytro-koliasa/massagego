import { NextResponse } from "next/server";
import { requirePortalUser } from "@/lib/portal-session.server";
import { requestPhoneConfirm } from "@/lib/telegram/account";
import {
  sendTelegramMessage,
  shareContactKeyboard,
} from "@/lib/telegram/api";
import { botText } from "@/lib/telegram/texts";

export async function POST() {
  const gate = await requirePortalUser();
  if (!gate.ok) return gate.response;

  const requested = await requestPhoneConfirm(gate.userId);
  if (!requested.ok) {
    return NextResponse.json({ error: requested.error }, { status: 409 });
  }

  await sendTelegramMessage({
    chatId: requested.chatId,
    text: botText(requested.locale, "sharePrompt"),
    replyMarkup: shareContactKeyboard(requested.locale),
  });

  return NextResponse.json({ ok: true });
}
