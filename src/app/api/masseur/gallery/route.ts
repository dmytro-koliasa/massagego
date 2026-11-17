import { NextResponse } from "next/server";
import { auth } from "@/auth/masseur";
import {
  ImageProcessError,
  MAX_UPLOAD_BYTES,
} from "@/lib/image-process";
import { userHasPortal } from "@/lib/portals.server";
import { prisma } from "@/lib/prisma";
import { deleteUpload, storeUpload } from "@/lib/uploads";

const MAX_GALLERY_IMAGES = 3;

async function requireMasseur() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  const allowed = await userHasPortal(session.user.id, "masseur");
  if (!allowed) {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { userId: session.user.id };
}

export async function GET() {
  const gate = await requireMasseur();
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
  const gate = await requireMasseur();
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
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
