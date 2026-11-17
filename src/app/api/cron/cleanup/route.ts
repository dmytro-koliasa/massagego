import { NextResponse } from "next/server";
import { processBookingCleanup } from "@/lib/booking-cleanup";
import { authorizeCron } from "@/lib/cron-auth";

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await processBookingCleanup();
    console.info("[cron/cleanup]", result);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron/cleanup]", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
