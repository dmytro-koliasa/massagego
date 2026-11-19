import { NextResponse } from "next/server";
import { auth as clientAuth } from "@/auth/client";
import { auth as masseurAuth } from "@/auth/masseur";
import { createComplaint } from "@/lib/complaints";
import {
  rateLimitJsonResponse,
  resolveRequestLocale,
} from "@/lib/http/rate-limit-response";
import { logRouteError } from "@/lib/http/route-error";
import { prisma } from "@/lib/prisma";
import { userHasPortal } from "@/lib/portals.server";
import { checkRateLimit, RATE_LIMITS, rateLimitKey } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { parseWithSchema } from "@/lib/validation";
import { complaintCreateSchema } from "@/lib/validation/complaints";

async function requireReporter(): Promise<
  | { ok: true; userId: string; portal: "client" | "masseur" }
  | { ok: false; status: 401 | 403; error: "unauthorized" | "forbidden" }
> {
  const clientSession = await clientAuth();
  if (clientSession?.user?.id) {
    const allowed = await userHasPortal(clientSession.user.id, "client");
    if (allowed) {
      return { ok: true, userId: clientSession.user.id, portal: "client" };
    }
  }

  const masseurSession = await masseurAuth();
  if (masseurSession?.user?.id) {
    const allowed = await userHasPortal(masseurSession.user.id, "masseur");
    if (allowed) {
      return { ok: true, userId: masseurSession.user.id, portal: "masseur" };
    }
  }

  if (clientSession?.user?.id || masseurSession?.user?.id) {
    return { ok: false, status: 403, error: "forbidden" };
  }
  return { ok: false, status: 401, error: "unauthorized" };
}

export async function POST(request: Request) {
  try {
    const reporter = await requireReporter();
    if (!reporter.ok) {
      return NextResponse.json(
        { error: reporter.error },
        { status: reporter.status },
      );
    }

    const locale = resolveRequestLocale(request);
    const ipLimit = await checkRateLimit(
      rateLimitKey("complaint-create:ip", getClientIp(request)),
      RATE_LIMITS.complaintCreate.limit,
      RATE_LIMITS.complaintCreate.windowMs,
    );
    if (!ipLimit.ok) {
      return rateLimitJsonResponse(ipLimit.retryAfterSec, locale);
    }
    const accountLimit = await checkRateLimit(
      rateLimitKey("complaint-create:account", reporter.userId),
      RATE_LIMITS.complaintCreate.limit,
      RATE_LIMITS.complaintCreate.windowMs,
    );
    if (!accountLimit.ok) {
      return rateLimitJsonResponse(accountLimit.retryAfterSec, locale);
    }

    const body = await request.json();
    const parsed = parseWithSchema(complaintCreateSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const result = await createComplaint(prisma, {
      reporterId: reporter.userId,
      reporterPortal: reporter.portal,
      bookingId: parsed.data.bookingId,
      category: parsed.data.category,
      body: parsed.data.body,
    });

    if (!result.ok) {
      const status =
        result.error === "booking_not_found" ||
        result.error === "no_relationship"
          ? 404
          : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({ ok: true, id: result.id });
  } catch (error) {
    logRouteError("complaints", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
