import { NextResponse } from "next/server";
import { changeAdminPassword } from "@/lib/admin-password";
import { requireAdmin } from "@/lib/admin-session.server";
import { logRouteError } from "@/lib/http/route-error";
import { parseWithSchema } from "@/lib/validation";
import { adminPasswordChangeSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  try {
    const body = await request.json().catch(() => null);
    const parsed = parseWithSchema(adminPasswordChangeSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const result = await changeAdminPassword({
      adminUserId: gate.userId,
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.password,
    });

    if (!result.ok) {
      const status =
        result.error === "unauthorized"
          ? 401
          : result.error === "invalid_current"
            ? 403
            : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logRouteError("admin/password", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
