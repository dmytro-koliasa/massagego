import { NextResponse } from "next/server";
import { consumeVerificationToken } from "@/lib/email/verification";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim() ?? "";
  const origin = new URL(request.url).origin;

  if (!token) {
    return NextResponse.redirect(
      `${origin}/client?emailVerified=missing`,
    );
  }

  const result = await consumeVerificationToken(token);
  if (!result.ok) {
    return NextResponse.redirect(
      `${origin}/client?emailVerified=invalid`,
    );
  }

  return NextResponse.redirect(`${origin}/client?emailVerified=ok`);
}
