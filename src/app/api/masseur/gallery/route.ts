import { NextResponse } from "next/server";
import { logRouteError } from "@/lib/http/route-error";
import {
  ImageProcessError,
  MAX_UPLOAD_BYTES,
} from "@/lib/image-process";
import { requireMasseurSession } from "@/lib/masseur-session.server";
import { prisma } from "@/lib/prisma";
import { deleteUpload, storeUpload } from "@/lib/uploads";

const MAX_GALLERY_IMAGES = 3;

export async function GET() {
  const gate = await requireMasseurSession();
  if ("error" in gate) return gate.error;

  const images = await prisma.galleryImage.findMany({
    where: { masseurId: gate.userId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      url: true,
      width: true,
      height: true,
      sortOrder: true,
    },
  });

  return NextResponse.json({ images });
}

export async function POST(request: Request) {
  const gate = await requireMasseurSession();
  if ("error" in gate) return gate.error;

  try {
    const count = await prisma.galleryImage.count({
      where: { masseurId: gate.userId },
    });
    if (count >= MAX_GALLERY_IMAGES) {
      return NextResponse.json({ error: "too_many" }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("photo");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "missing_file" }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "too_large" }, { status: 400 });
    }

    const uploaded = await storeUpload({
      folder: "gallery",
      ownerId: gate.userId,
      file,
    });

    const last = await prisma.galleryImage.findFirst({
      where: { masseurId: gate.userId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const image = await prisma.galleryImage.create({
      data: {
        masseurId: gate.userId,
        url: uploaded.url,
        width: uploaded.width,
        height: uploaded.height,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
      select: {
        id: true,
        url: true,
        width: true,
        height: true,
        sortOrder: true,
      },
    });

    return NextResponse.json({ image });
  } catch (error) {
    if (error instanceof ImageProcessError) {
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    logRouteError("masseur/gallery", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
