import { auth } from "@/auth/client";
import { userHasPortal } from "@/lib/portals.server";

type ClientSessionOk = {
  ok: true;
  userId: string;
};

type ClientSessionErr = {
  ok: false;
  status: 401 | 403;
  error: "unauthorized" | "forbidden";
};

/** Require an authenticated user with client portal membership. */
export async function requireClientSession(): Promise<
  ClientSessionOk | ClientSessionErr
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, status: 401, error: "unauthorized" };
  }

  const allowed = await userHasPortal(session.user.id, "client");
  if (!allowed) {
    return { ok: false, status: 403, error: "forbidden" };
  }

  return { ok: true, userId: session.user.id };
}
