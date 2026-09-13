import { NextResponse } from "next/server";
import { auth } from "@/auth/masseur";
import { userHasPortal } from "@/lib/portals.server";
import { prisma } from "@/lib/prisma";
import { deleteUpload, storeUpload } from "@/lib/uploads";

const MAX_SIZE = 5 * 1024 * 1024;
const MAX_GALLERY_IMAGES = 3;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png"]);

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

function parsePositiveInt(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
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
    const width = parsePositiveInt(formData.get("width"));
    const height = parsePositiveInt(formData.get("height"));

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "missing_file" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "invalid_type" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "too_large" }, { status: 400 });
    }
    if (!width || !height) {
      return NextResponse.json({ error: "invalid_dimensions" }, { status: 400 });
    }

    const url = await storeUpload({
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
        url,
        width,
        height,
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
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
