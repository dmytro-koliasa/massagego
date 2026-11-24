import { NextResponse } from "next/server";
import { logRouteError } from "@/lib/http/route-error";
import { requireMasseurSession } from "@/lib/masseur-session.server";
import { prisma } from "@/lib/prisma";
import { deleteUpload } from "@/lib/uploads";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const gate = await requireMasseurSession();
  if (!gate.ok) return gate.response;

  const { id } = await context.params;

  try {
    const image = await prisma.galleryImage.findFirst({
      where: { id, masseurId: gate.userId },
      select: { id: true, url: true },
    });

    if (!image) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    await prisma.galleryImage.delete({ where: { id: image.id } });
    await deleteUpload(image.url);

    return NextResponse.json({ ok: true });
  } catch (error) {
    logRouteError("masseur/gallery/[id]", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
