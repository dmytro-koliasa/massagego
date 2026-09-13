import { NextResponse } from "next/server";
import { auth } from "@/auth/masseur";
import {
  normalizeMassageTypesInput,
  parseMassageTypes,
  serializeMassageTypes,
} from "@/lib/massage-types";
import { prisma } from "@/lib/prisma";
import { userHasPortal } from "@/lib/portals.server";
import { allocateUniqueSlug, buildSlugBase } from "@/lib/slug";
import { deleteUpload, storeUpload } from "@/lib/uploads";
import { masseurProfileSchema, parseWithSchema } from "@/lib/validation";

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
  slug: true,
  email: true,
  image: true,
  descriptionEn: true,
  descriptionUk: true,
  massageTypes: true,
  city: true,
  address: true,
} as const;

function toProfileResponse(user: {
  id: string;
  name: string | null;
  nameEn: string | null;
  nameUk: string | null;
  slug: string | null;
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
    const parsed = parseWithSchema(masseurProfileSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const {
      nameEn,
      nameUk,
      descriptionEn,
      descriptionUk,
      city,
      address,
      massageTypes: massageTypesRaw,
    } = parsed.data;

    const massageTypes = normalizeMassageTypesInput(massageTypesRaw);

    const data: {
      name?: string | null;
      nameEn?: string | null;
      nameUk?: string | null;
      descriptionEn?: string | null;
      descriptionUk?: string | null;
      city: string;
      address: string;
      massageTypes?: string;
      slug?: string;
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
    // Assign a stable public slug once (from name), so booking links stay shareable.
    if (nameEn !== undefined || nameUk !== undefined) {
      const current = await prisma.user.findUnique({
        where: { id: gate.userId },
        select: { nameEn: true, nameUk: true, name: true, slug: true },
      });
      const nextEn = nameEn !== undefined ? nameEn : current?.nameEn;
      const nextUk = nameUk !== undefined ? nameUk : current?.nameUk;
      data.name = nextEn || nextUk || null;

      if (!current?.slug) {
        data.slug = await allocateUniqueSlug(
          buildSlugBase([nextEn, nextUk, current?.name]),
          { excludeUserId: gate.userId },
        );
      }
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

    const imagePath = await storeUpload({
      folder: "masseurs",
      ownerId: gate.userId,
      file,
    });

    const user = await prisma.user.update({
      where: { id: gate.userId },
      data: { image: imagePath },
      select: profileSelect,
    });

    await deleteUpload(current?.image);

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

    await deleteUpload(current?.image);

    return NextResponse.json({ user: toProfileResponse(user) });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
