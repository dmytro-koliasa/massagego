import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { toCityWriteData } from "@/lib/city";
import { createAndSendVerificationLink } from "@/lib/email/verification";
import {
  rateLimitJsonResponse,
  resolveRequestLocale,
} from "@/lib/http/rate-limit-response";
import {
  findPortalUserByEmail,
  findPortalUserByPhone,
} from "@/lib/portals.server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { allocateUniqueSlug, buildSlugBase } from "@/lib/slug";
import {
  clientRegisterSchema,
  parseWithSchema,
  registerSchema,
  resolvePortalInput,
} from "@/lib/validation";

function prismaErrorCode(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const portal = resolvePortalInput(body);
    const origin = new URL(request.url).origin;
    const requestLocale = resolveRequestLocale(
      request,
      body && typeof body === "object"
        ? (body as { preferredLocale?: unknown }).preferredLocale
        : undefined,
    );

    const ipLimit = await checkRateLimit(
      `register:ip:${getClientIp(request)}`,
      RATE_LIMITS.register.limit,
      RATE_LIMITS.register.windowMs,
    );
    if (!ipLimit.ok) {
      return rateLimitJsonResponse(ipLimit.retryAfterSec, requestLocale);
    }

    if (portal === "client") {
      const parsed = parseWithSchema(clientRegisterSchema, body);
      if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }

      const { name, phone, email, city, password, preferredLocale } =
        parsed.data;
      const locale = preferredLocale === "uk" ? "uk" : "en";

      const existing = await findPortalUserByPhone(phone, "client");
      if (existing) {
        return NextResponse.json({ error: "phone_taken" }, { status: 409 });
      }

      const emailTaken = await findPortalUserByEmail(email, "client");
      if (emailTaken) {
        return NextResponse.json({ error: "email_taken" }, { status: 409 });
      }

      const passwordHash = await hash(password, 12);
      const cityData = toCityWriteData(city, locale);
      const user = await prisma.user.create({
        data: {
          name,
          email,
          phone,
          passwordHash,
          portal: "client",
          preferredLocale: locale,
          ...cityData,
        },
        select: {
          id: true,
          email: true,
          phone: true,
          name: true,
          portal: true,
          slug: true,
          preferredLocale: true,
        },
      });

      await createAndSendVerificationLink({
        userId: user.id,
        email,
        origin,
        locale,
      });

      return NextResponse.json({ user }, { status: 201 });
    }

    const parsed = parseWithSchema(registerSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { name, email, password, preferredLocale } = parsed.data;
    const locale = preferredLocale === "uk" ? "uk" : "en";

    const existing = await findPortalUserByEmail(email, portal);
    if (existing) {
      return NextResponse.json({ error: "email_taken" }, { status: 409 });
    }

    const passwordHash = await hash(password, 12);
    const slug =
      portal === "masseur"
        ? await allocateUniqueSlug(buildSlugBase([name, email.split("@")[0]]))
        : null;

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        portal,
        slug,
        preferredLocale: locale,
      },
      select: {
        id: true,
        email: true,
        name: true,
        portal: true,
        slug: true,
        preferredLocale: true,
      },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error("[auth/register]", error);
    const code = prismaErrorCode(error);
    if (code === "P2002") {
      return NextResponse.json({ error: "email_taken" }, { status: 409 });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
