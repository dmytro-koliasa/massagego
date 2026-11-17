import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { processNotificationOutbox } from "@/lib/notifications/outbox";

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await processNotificationOutbox();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron/notifications]", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
