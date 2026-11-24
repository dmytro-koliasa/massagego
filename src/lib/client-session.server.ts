import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/auth/client";
import { userHasPortal } from "@/lib/portals.server";

type ClientSessionOk = {
  ok: true;
  userId: string;
};

type ClientSessionErr = {
  ok: false;
  response: NextResponse;
};

/** Require an authenticated user with client portal membership (#187 shape). */
export async function requireClientSession(): Promise<
  ClientSessionOk | ClientSessionErr
> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }

  const allowed = await userHasPortal(session.user.id, "client");
  if (!allowed) {
    return {
      ok: false,
      response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  }

  return { ok: true, userId: session.user.id };
}
