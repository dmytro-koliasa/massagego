import { NextResponse } from "next/server";

export async function GET() {
  const googleConfigured =
    Boolean(process.env.AUTH_GOOGLE_ID?.trim()) &&
    Boolean(process.env.AUTH_GOOGLE_SECRET?.trim());

  return NextResponse.json({ googleConfigured });
}
