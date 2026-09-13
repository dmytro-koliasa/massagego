import { NextResponse } from "next/server";
import { requireClientSession } from "@/lib/client-session.server";
import { prisma } from "@/lib/prisma";
import { deleteUpload, storeUpload } from "@/lib/uploads";
import { clientProfileSchema, parseWithSchema } from "@/lib/validation";

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const profileSelect = {
  id: true,
  name: true,
  nameEn: true,
  nameUk: true,
  email: true,
  image: true,
} as const;

function toClientError(status: 401 | 403) {
  return NextResponse.json(
    { error: status === 401 ? "unauthorized" : "forbidden" },
    { status },
  );
}

export async function GET() {
  const client = await requireClientSession();
  if (!client.ok) return toClientError(client.status);

  const user = await prisma.user.findUnique({
    where: { id: client.userId },
    select: profileSelect,
  });

  if (!user) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ user });
}

export async function PATCH(request: Request) {
  const client = await requireClientSession();
  if (!client.ok) return toClientError(client.status);

  try {
    const body = await request.json();
    const parsed = parseWithSchema(clientProfileSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { nameEn, nameUk } = parsed.data;

    const data: {
      name?: string | null;
      nameEn?: string | null;
      nameUk?: string | null;
    } = {};

    if (nameEn !== undefined) data.nameEn = nameEn;
    if (nameUk !== undefined) data.nameUk = nameUk;

    if (nameEn !== undefined || nameUk !== undefined) {
      const current = await prisma.user.findUnique({
        where: { id: client.userId },
        select: { nameEn: true, nameUk: true },
      });
      const nextEn = nameEn !== undefined ? nameEn : current?.nameEn;
      const nextUk = nameUk !== undefined ? nameUk : current?.nameUk;
      data.name = nextEn || nextUk || null;
    }

    const user = await prisma.user.update({
      where: { id: client.userId },
      data,
      select: profileSelect,
    });

    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const client = await requireClientSession();
  if (!client.ok) return toClientError(client.status);

  try {
    const formData = await request.formData();
    const file = formData.get("photo");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "missing_file" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "invalid_type" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "too_large" }, { status: 400 });
    }

    const current = await prisma.user.findUnique({
      where: { id: client.userId },
      select: { image: true },
    });

    const imagePath = await storeUpload({
      folder: "clients",
      ownerId: client.userId,
      file,
    });

    const user = await prisma.user.update({
      where: { id: client.userId },
      data: { image: imagePath },
      select: profileSelect,
    });

    await deleteUpload(current?.image);

    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function DELETE() {
  const client = await requireClientSession();
  if (!client.ok) return toClientError(client.status);

  try {
    const current = await prisma.user.findUnique({
      where: { id: client.userId },
      select: { image: true },
    });

    const user = await prisma.user.update({
      where: { id: client.userId },
      data: { image: null },
      select: profileSelect,
    });

    await deleteUpload(current?.image);

    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
