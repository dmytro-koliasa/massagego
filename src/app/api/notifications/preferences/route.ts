import { NextResponse } from "next/server";
import { auth as clientAuth } from "@/auth/client";
import { auth as masseurAuth } from "@/auth/masseur";
import {
  getNotificationPreferences,
  saveNotificationPreferences,
} from "@/lib/notifications/prefs";
import type { PrefPatch } from "@/lib/notifications/prefs";
import { prisma } from "@/lib/prisma";
import { parseWithSchema } from "@/lib/validation";
import { notificationPreferencesPatchSchema } from "@/lib/validation/notifications";

async function requirePortalUser(): Promise<
  | { ok: true; userId: string; portal: "client" | "masseur" }
  | { ok: false; response: NextResponse }
> {
  const [clientSession, masseurSession] = await Promise.all([
    clientAuth(),
    masseurAuth(),
  ]);

  const clientId = clientSession?.user?.id;
  const masseurId = masseurSession?.user?.id;

  if (clientId) {
    const user = await prisma.user.findUnique({
      where: { id: clientId },
      select: { portal: true },
    });
    if (user?.portal === "client") {
      return { ok: true, userId: clientId, portal: "client" };
    }
  }

  if (masseurId) {
    const user = await prisma.user.findUnique({
      where: { id: masseurId },
      select: { portal: true },
    });
    if (user?.portal === "masseur") {
      return { ok: true, userId: masseurId, portal: "masseur" };
    }
  }

  return {
    ok: false,
    response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
  };
}

export async function GET() {
  const gate = await requirePortalUser();
  if (!gate.ok) return gate.response;

  const preferences = await getNotificationPreferences(
    gate.userId,
    gate.portal,
  );
  return NextResponse.json({ preferences, portal: gate.portal });
}

export async function PATCH(request: Request) {
  const gate = await requirePortalUser();
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = parseWithSchema(notificationPreferencesPatchSchema, body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await saveNotificationPreferences(
    gate.userId,
    gate.portal,
    parsed.data.preferences as PrefPatch[],
  );
  if (!result.ok) {
    const status =
      result.error === "critical_email_required" ? 409 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ preferences: result.preferences });
}
