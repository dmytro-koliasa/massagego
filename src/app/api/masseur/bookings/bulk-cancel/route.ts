import { NextResponse } from "next/server";
import { auth } from "@/auth/masseur";
import {
  rateLimitJsonResponse,
  resolveRequestLocale,
} from "@/lib/http/rate-limit-response";
import {
  bulkCancelMasseurFutureBookings,
  countMasseurFutureBookings,
} from "@/lib/masseur-bulk-cancel";
import { getMasseurTimeZone } from "@/lib/masseur-time.server";
import { checkRateLimit, RATE_LIMITS, rateLimitKey } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import {
  masseurBulkCancelSchema,
  parseWithSchema,
} from "@/lib/validation";

async function requireMasseur() {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      error: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }
  const timeZone = await getMasseurTimeZone(session.user.id);
  if (!timeZone) {
    return {
      error: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  }
  return { userId: session.user.id };
}

export async function GET() {
  const gate = await requireMasseur();
  if ("error" in gate) return gate.error;

  const count = await countMasseurFutureBookings(gate.userId);
  return NextResponse.json({ count });
}

export async function POST(request: Request) {
  try {
    const gate = await requireMasseur();
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
    console.error("[masseur/bookings/bulk-cancel]", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
