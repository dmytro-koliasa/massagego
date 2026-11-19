import { NextResponse } from "next/server";
import {
  authorizeTelegramWebhook,
  readTelegramWebhookAuthEnv,
} from "@/lib/telegram/webhook-auth";
import { handleTelegramUpdate } from "@/lib/telegram/webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = authorizeTelegramWebhook(
    request.headers.get("x-telegram-bot-api-secret-token"),
    readTelegramWebhookAuthEnv(),
  );
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    await handleTelegramUpdate(
      body as Parameters<typeof handleTelegramUpdate>[0],
    );
  } catch (error) {
    console.error("[telegram-webhook]", error);
  }

  // Always 200 so Telegram does not retry endlessly on app bugs.
  return NextResponse.json({ ok: true });
}
