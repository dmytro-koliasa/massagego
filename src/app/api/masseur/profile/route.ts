import { NextResponse } from "next/server";
import { auth } from "@/auth/masseur";
import { resolveBookingSettings } from "@/lib/booking-settings";
import { cityDisplayName, toCityWriteData } from "@/lib/city";
import {
  normalizeMassageTypesInput,
  parseMassageTypes,
  serializeMassageTypes,
} from "@/lib/massage-types";
import { prisma } from "@/lib/prisma";
import { userHasPortal } from "@/lib/portals.server";
import { allocateUniqueSlug, buildSlugBase } from "@/lib/slug";
import {
  ImageProcessError,
  MAX_UPLOAD_BYTES,
} from "@/lib/image-process";
import { deleteUpload, storeUpload } from "@/lib/uploads";
import { masseurProfileSchema, parseWithSchema } from "@/lib/validation";

const profileSelect = {
  id: true,
  name: true,
  nameEn: true,
  nameUk: true,
  slug: true,
  email: true,
  phone: true,
  image: true,
  descriptionEn: true,
  descriptionUk: true,
  massageTypes: true,
  city: true,
  cityPlaceId: true,
  cityCountryCode: true,
  cityNameEn: true,
  cityNameUk: true,
  cityLat: true,
  cityLon: true,
  address: true,
  timezone: true,
  preferredLocale: true,
  bookingLeadHours: true,
  cancelCutoffHours: true,
} as const;

function toProfileResponse(
  user: {
    id: string;
    name: string | null;
    nameEn: string | null;
    nameUk: string | null;
    slug: string | null;
    email: string;
    phone: string | null;
    image: string | null;
    descriptionEn: string | null;
    descriptionUk: string | null;
    massageTypes: string;
    city: string | null;
    cityPlaceId: string | null;
    cityCountryCode: string | null;
    cityNameEn: string | null;
    cityNameUk: string | null;
    cityLat: number | null;
    cityLon: number | null;
    address: string | null;
    timezone: string;
    preferredLocale: string;
    bookingLeadHours: number;
    cancelCutoffHours: number;
  },
  locale: "en" | "uk" = "en",
) {
  const settings = resolveBookingSettings(user);
  return {
    ...user,
    cityLabel: cityDisplayName(user, locale),
    massageTypes: parseMassageTypes(user.massageTypes),
    bookingLeadHours: settings.bookingLeadHours,
    cancelCutoffHours: settings.cancelCutoffHours,
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

  const locale = user.preferredLocale === "uk" ? "uk" : "en";
  return NextResponse.json({ user: toProfileResponse(user, locale) });
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
      phone,
      timezone,
      preferredLocale,
      massageTypes: massageTypesRaw,
    } = parsed.data;

    const massageTypes = normalizeMassageTypesInput(massageTypesRaw);
    const locale = preferredLocale === "uk" ? "uk" : "en";
    const cityData = toCityWriteData(city, locale);

    const data: Record<string, unknown> = {
      ...cityData,
      address,
      phone,
      timezone,
    };

    if (preferredLocale) data.preferredLocale = preferredLocale;
    if (nameEn !== undefined) data.nameEn = nameEn;
    if (nameUk !== undefined) data.nameUk = nameUk;
    if (descriptionEn !== undefined) data.descriptionEn = descriptionEn;
    if (descriptionUk !== undefined) data.descriptionUk = descriptionUk;
    if (massageTypes !== undefined) {
      data.massageTypes = serializeMassageTypes(massageTypes);
    }

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

    return NextResponse.json({
      user: toProfileResponse(user, locale),
    });
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

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "too_large" }, { status: 400 });
    }

    const current = await prisma.user.findUnique({
      where: { id: gate.userId },
      select: { image: true, preferredLocale: true },
    });

    const uploaded = await storeUpload({
      folder: "masseurs",
      ownerId: gate.userId,
      file,
    });

    const user = await prisma.user.update({
      where: { id: gate.userId },
      data: { image: uploaded.url },
      select: profileSelect,
    });

    await deleteUpload(current?.image);

    const locale = current?.preferredLocale === "uk" ? "uk" : "en";
    return NextResponse.json({ user: toProfileResponse(user, locale) });
  } catch (error) {
    if (error instanceof ImageProcessError) {
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function DELETE() {
  const gate = await requireMasseur();
  if ("error" in gate) return gate.error;

  try {
    const current = await prisma.user.findUnique({
      where: { id: gate.userId },
      select: { image: true, preferredLocale: true },
    });

    const user = await prisma.user.update({
      where: { id: gate.userId },
      data: { image: null },
      select: profileSelect,
    });

    await deleteUpload(current?.image);

    const locale = current?.preferredLocale === "uk" ? "uk" : "en";
    return NextResponse.json({ user: toProfileResponse(user, locale) });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
