import { NextResponse } from "next/server";
import { requirePortalUser } from "@/lib/notifications/portal-gate";
import { createTelegramLinkToken } from "@/lib/telegram/link";
import { telegramConfigured } from "@/lib/telegram/config";

export async function POST() {
  const gate = await requirePortalUser();
  if (!gate.ok) return gate.response;

  if (!telegramConfigured()) {
    return NextResponse.json(
      { error: "telegram_not_configured" },
      { status: 503 },
    );
  }

  const created = await createTelegramLinkToken(gate.userId);
  if (!created.ok) {
    return NextResponse.json({ error: created.error }, { status: 503 });
  }

  return NextResponse.json({
    url: created.url,
    expiresAt: created.expiresAt.toISOString(),
  });
}
