import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { auth } from "@/auth/masseur";
import {
  normalizeMassageTypesInput,
  parseMassageTypes,
  serializeMassageTypes,
} from "@/lib/massage-types";
import { prisma } from "@/lib/prisma";
import { userHasPortal } from "@/lib/portals.server";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "masseurs");
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
  descriptionEn: true,
  descriptionUk: true,
  massageTypes: true,
  city: true,
  address: true,
} as const;

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, maxLength);
  return trimmed.length ? trimmed : null;
}

function toProfileResponse(user: {
  id: string;
  name: string | null;
  nameEn: string | null;
  nameUk: string | null;
  email: string;
  image: string | null;
  descriptionEn: string | null;
  descriptionUk: string | null;
  massageTypes: string;
  city: string | null;
  address: string | null;
}) {
  return {
    ...user,
    massageTypes: parseMassageTypes(user.massageTypes),
  };
}

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

  const user = await prisma.user.findUnique({
    where: { id: gate.userId },
    select: profileSelect,
  });

  if (!user) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ user: toProfileResponse(user) });
}

export async function PATCH(request: Request) {
  const gate = await requireMasseur();
  if ("error" in gate) return gate.error;

  try {
    const body = await request.json();
    const nameEn = normalizeText(body.nameEn, 120);
    const nameUk = normalizeText(body.nameUk, 120);
    const descriptionEn = normalizeText(body.descriptionEn, 2000);
    const descriptionUk = normalizeText(body.descriptionUk, 2000);
    const massageTypes = normalizeMassageTypesInput(body.massageTypes);

    if (typeof body.city !== "string" || typeof body.address !== "string") {
      return NextResponse.json(
        { error: "address_required" },
        { status: 400 },
      );
    }

    const city = body.city.trim().slice(0, 120);
    const address = body.address.trim().slice(0, 300);

    if (!city || !address) {
      return NextResponse.json(
        { error: "address_required" },
        { status: 400 },
      );
    }

    const data: {
      name?: string | null;
      nameEn?: string | null;
      nameUk?: string | null;
      descriptionEn?: string | null;
      descriptionUk?: string | null;
      city: string;
      address: string;
      massageTypes?: string;
    } = {
      city,
      address,
    };

    if (nameEn !== undefined) data.nameEn = nameEn;
    if (nameUk !== undefined) data.nameUk = nameUk;
    if (descriptionEn !== undefined) data.descriptionEn = descriptionEn;
    if (descriptionUk !== undefined) data.descriptionUk = descriptionUk;
    if (massageTypes !== undefined) {
      data.massageTypes = serializeMassageTypes(massageTypes);
    }

    // Keep Auth.js `name` in sync for sessions / Google accounts.
    if (nameEn !== undefined || nameUk !== undefined) {
      const current = await prisma.user.findUnique({
        where: { id: gate.userId },
        select: { nameEn: true, nameUk: true },
      });
      const nextEn = nameEn !== undefined ? nameEn : current?.nameEn;
      const nextUk = nameUk !== undefined ? nameUk : current?.nameUk;
      data.name = nextEn || nextUk || null;
    }

    const user = await prisma.user.update({
      where: { id: gate.userId },
      data,
      select: profileSelect,
    });

    return NextResponse.json({ user: toProfileResponse(user) });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const gate = await requireMasseur();
  if ("error" in gate) return gate.error;

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
      where: { id: gate.userId },
      select: { image: true },
    });

    await mkdir(UPLOAD_DIR, { recursive: true });

    const extension = file.type.split("/")[1] || "jpg";
    const filename = `${gate.userId}-${Date.now()}.${extension}`;
    const filepath = path.join(UPLOAD_DIR, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    const imagePath = `/uploads/masseurs/${filename}`;

    const user = await prisma.user.update({
      where: { id: gate.userId },
      data: { image: imagePath },
      select: profileSelect,
    });

    await deleteLocalUpload(current?.image);

    return NextResponse.json({ user: toProfileResponse(user) });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function DELETE() {
  const gate = await requireMasseur();
  if ("error" in gate) return gate.error;

  try {
    const current = await prisma.user.findUnique({
      where: { id: gate.userId },
      select: { image: true },
    });

    const user = await prisma.user.update({
      where: { id: gate.userId },
      data: { image: null },
      select: profileSelect,
    });

    await deleteLocalUpload(current?.image);

    return NextResponse.json({ user: toProfileResponse(user) });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

async function deleteLocalUpload(image: string | null | undefined) {
  if (!image?.startsWith("/uploads/masseurs/")) return;
  const filename = path.basename(image);
  try {
    await unlink(path.join(UPLOAD_DIR, filename));
  } catch {
    // File may already be gone.
  }
}
