import { NextResponse } from "next/server";
import { processNotificationOutbox } from "@/lib/notifications/outbox";

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    // Local/dev without secret: allow only outside production.
    return process.env.NODE_ENV !== "production";
  }
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

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
