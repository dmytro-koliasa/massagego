import { NextResponse } from "next/server";
import { cityDisplayName, toCityWriteData } from "@/lib/city";
import { requireClientSession } from "@/lib/client-session.server";
import { createAndSendVerificationLink } from "@/lib/email/verification";
import { findPortalUserByEmail } from "@/lib/portals.server";
import { prisma } from "@/lib/prisma";
import {
  ImageProcessError,
  MAX_UPLOAD_BYTES,
} from "@/lib/image-process";
import { deleteUpload, storeUpload } from "@/lib/uploads";
import { clientProfileSchema, parseWithSchema } from "@/lib/validation";

const profileSelect = {
  id: true,
  name: true,
  nameEn: true,
  nameUk: true,
  email: true,
  emailVerified: true,
  image: true,
  city: true,
  cityPlaceId: true,
  cityCountryCode: true,
  cityNameEn: true,
  cityNameUk: true,
  cityLat: true,
  cityLon: true,
  preferredLocale: true,
} as const;

function toClientError(status: 401 | 403) {
  return NextResponse.json(
    { error: status === 401 ? "unauthorized" : "forbidden" },
    { status },
  );
}

function toProfile(
  user: {
    id: string;
    name: string | null;
    nameEn: string | null;
    nameUk: string | null;
    email: string;
    emailVerified: Date | null;
    image: string | null;
    city: string | null;
    cityPlaceId: string | null;
    cityCountryCode: string | null;
    cityNameEn: string | null;
    cityNameUk: string | null;
    cityLat: number | null;
    cityLon: number | null;
    preferredLocale: string;
  },
) {
  const locale = user.preferredLocale === "uk" ? "uk" : "en";
  return {
    ...user,
    cityLabel: cityDisplayName(user, locale),
    profileComplete: Boolean(
      user.cityPlaceId?.trim() &&
        user.email &&
        !user.email.toLowerCase().endsWith("@client.local"),
    ),
    emailVerified: Boolean(user.emailVerified),
  };
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

  return NextResponse.json({ user: toProfile(user) });
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

    const { nameEn, nameUk, email, city, preferredLocale } = parsed.data;
    const current = await prisma.user.findUnique({
      where: { id: client.userId },
      select: {
        nameEn: true,
        nameUk: true,
        email: true,
        preferredLocale: true,
      },
    });
    if (!current) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const locale =
      preferredLocale ??
      (current.preferredLocale === "uk" ? "uk" : "en");

    const data: Record<string, unknown> = {};

    if (nameEn !== undefined) data.nameEn = nameEn;
    if (nameUk !== undefined) data.nameUk = nameUk;
    if (preferredLocale) data.preferredLocale = preferredLocale;

    if (nameEn !== undefined || nameUk !== undefined) {
      const nextEn = nameEn !== undefined ? nameEn : current.nameEn;
      const nextUk = nameUk !== undefined ? nameUk : current.nameUk;
      data.name = nextEn || nextUk || null;
    }

    if (city) {
      Object.assign(data, toCityWriteData(city, locale === "uk" ? "uk" : "en"));
    }

    let emailChanged = false;
    if (email && email !== current.email.toLowerCase()) {
      const taken = await findPortalUserByEmail(email, "client");
      if (taken && taken.id !== client.userId) {
        return NextResponse.json({ error: "email_taken" }, { status: 409 });
      }
      data.email = email;
      data.emailVerified = null;
      emailChanged = true;
    }

    const user = await prisma.user.update({
      where: { id: client.userId },
      data,
      select: profileSelect,
    });

    if (emailChanged) {
      await createAndSendVerificationLink({
        userId: client.userId,
        email: user.email,
        origin: new URL(request.url).origin,
        locale: user.preferredLocale === "uk" ? "uk" : "en",
      });
    }

    return NextResponse.json({ user: toProfile(user) });
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

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "too_large" }, { status: 400 });
    }

    const current = await prisma.user.findUnique({
      where: { id: client.userId },
      select: { image: true },
    });

    const uploaded = await storeUpload({
      folder: "clients",
      ownerId: client.userId,
      file,
    });

    const user = await prisma.user.update({
      where: { id: client.userId },
      data: { image: uploaded.url },
      select: profileSelect,
    });

    await deleteUpload(current?.image);

    return NextResponse.json({ user: toProfile(user) });
  } catch (error) {
    if (error instanceof ImageProcessError) {
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
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

    return NextResponse.json({ user: toProfile(user) });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
