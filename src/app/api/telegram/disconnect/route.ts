import { NextResponse } from "next/server";
import { requirePortalUser } from "@/lib/notifications/portal-gate";
import { disconnectTelegramForUser } from "@/lib/telegram/account";

export async function POST() {
  const gate = await requirePortalUser();
  if (!gate.ok) return gate.response;

  await disconnectTelegramForUser(gate.userId);
  return NextResponse.json({ ok: true });
}
