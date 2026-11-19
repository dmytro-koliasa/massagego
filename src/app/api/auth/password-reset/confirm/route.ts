import { NextResponse } from "next/server";
import { consumeResetToken } from "@/lib/email/password-reset";
import { logRouteError } from "@/lib/http/route-error";
import {
  parseWithSchema,
  passwordResetConfirmSchema,
} from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = parseWithSchema(passwordResetConfirmSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const result = await consumeResetToken({
      rawToken: parsed.data.token,
      password: parsed.data.password,
      passwordConfirm: parsed.data.passwordConfirm,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logRouteError("auth/password-reset/confirm", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
