import { NextResponse } from "next/server";
import { auth } from "@/auth/client";
import { queryMasseurCatalog } from "@/lib/masseur-catalog-query";
import { userHasPortal } from "@/lib/portals.server";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const allowed = await userHasPortal(session.user.id, "client");
  if (!allowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const result = await queryMasseurCatalog({
    clientUserId: session.user.id,
    page: searchParams.get("page"),
    pageSize: searchParams.get("pageSize"),
    city: searchParams.get("city"),
  });

  return NextResponse.json(result);
}
