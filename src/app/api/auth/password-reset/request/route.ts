import { NextResponse } from "next/server";
import { createAndSendResetLink } from "@/lib/email/password-reset";
import {
  rateLimitJsonResponse,
  resolveRequestLocale,
} from "@/lib/http/rate-limit-response";
import { logRouteError } from "@/lib/http/route-error";
import {
  AUTH_RATE_LIMIT_SCOPES,
  PASSWORD_RESET_IDENTIFIER_LIMIT,
  PASSWORD_RESET_IP_LIMIT,
} from "@/lib/auth/auth-rate-limit-policy";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import {
  parseWithSchema,
  passwordResetRequestSchema,
} from "@/lib/validation";

const SUCCESS_MESSAGES = {
  en: "If an account can reset its password, we sent a link.",
  uk: "Якщо для цього акаунта можливе скидання пароля, ми надіслали посилання.",
} as const;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = parseWithSchema(passwordResetRequestSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const locale = resolveRequestLocale(request, parsed.data.preferredLocale);
    const ip = getClientIp(request);
    const { portal } = parsed.data;
    const identifier =
      portal === "client" ? parsed.data.phone : parsed.data.email;

    const ipLimit = await checkRateLimit(
      rateLimitKey(AUTH_RATE_LIMIT_SCOPES.passwordResetIp, ip),
      PASSWORD_RESET_IP_LIMIT.limit,
      PASSWORD_RESET_IP_LIMIT.windowMs,
    );
    if (!ipLimit.ok) {
      return rateLimitJsonResponse(ipLimit.retryAfterSec, locale);
    }

    // Higher than IP so a third party cannot cheaply deny reset (#86).
    const idLimit = await checkRateLimit(
      rateLimitKey(
        AUTH_RATE_LIMIT_SCOPES.passwordResetIdentifier,
        `${portal}:${identifier}`,
      ),
      PASSWORD_RESET_IDENTIFIER_LIMIT.limit,
      PASSWORD_RESET_IDENTIFIER_LIMIT.windowMs,
    );
    if (!idLimit.ok) {
      return rateLimitJsonResponse(idLimit.retryAfterSec, locale);
    }

    const origin = new URL(request.url).origin;
    await createAndSendResetLink({
      portal,
      phone: portal === "client" ? parsed.data.phone : undefined,
      email: portal === "masseur" ? parsed.data.email : undefined,
      origin,
      locale,
    });

    return NextResponse.json({
      ok: true,
      message: SUCCESS_MESSAGES[locale],
    });
  } catch (error) {
    logRouteError("auth/password-reset/request", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
