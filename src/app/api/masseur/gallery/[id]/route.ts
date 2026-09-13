import { NextResponse } from "next/server";
import { auth } from "@/auth/masseur";
import { userHasPortal } from "@/lib/portals.server";
import { prisma } from "@/lib/prisma";
import { deleteUpload } from "@/lib/uploads";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const allowed = await userHasPortal(session.user.id, "masseur");
  if (!allowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const image = await prisma.galleryImage.findFirst({
      where: { id, masseurId: session.user.id },
      select: { id: true, url: true },
    });

    if (!image) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    await prisma.galleryImage.delete({ where: { id: image.id } });
    await deleteUpload(image.url);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
