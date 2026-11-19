import { NextResponse } from "next/server";
import {
  rateLimitJsonResponse,
  resolveRequestLocale,
} from "@/lib/http/rate-limit-response";
import { logRouteError } from "@/lib/http/route-error";
import {
  bulkCancelMasseurFutureBookings,
  countMasseurFutureBookings,
} from "@/lib/masseur-bulk-cancel";
import { requireMasseurSession } from "@/lib/masseur-session.server";
import { checkRateLimit, RATE_LIMITS, rateLimitKey } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import {
  masseurBulkCancelSchema,
  parseWithSchema,
} from "@/lib/validation";

export async function GET() {
  const gate = await requireMasseurSession();
  if ("error" in gate) return gate.error;

  const count = await countMasseurFutureBookings(gate.userId);
  return NextResponse.json({ count });
}

export async function POST(request: Request) {
  try {
    const gate = await requireMasseurSession();
    if ("error" in gate) return gate.error;

    const locale = resolveRequestLocale(request);
    const ipLimit = await checkRateLimit(
      rateLimitKey("masseur-bulk-cancel:ip", getClientIp(request)),
      RATE_LIMITS.masseurBulkCancel.limit,
      RATE_LIMITS.masseurBulkCancel.windowMs,
    );
    if (!ipLimit.ok) {
      return rateLimitJsonResponse(ipLimit.retryAfterSec, locale);
    }

    const accountLimit = await checkRateLimit(
      rateLimitKey("masseur-bulk-cancel:account", gate.userId),
      RATE_LIMITS.masseurBulkCancel.limit,
      RATE_LIMITS.masseurBulkCancel.windowMs,
    );
    if (!accountLimit.ok) {
      return rateLimitJsonResponse(accountLimit.retryAfterSec, locale);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    const parsed = parseWithSchema(masseurBulkCancelSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const result = await bulkCancelMasseurFutureBookings({
      masseurId: gate.userId,
      availability: parsed.data.availability,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      cancelledCount: result.cancelledCount,
      notifiedCount: result.notifiedCount,
      availability: result.availability,
    });
  } catch (error) {
    logRouteError("masseur/bookings/bulk-cancel", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
