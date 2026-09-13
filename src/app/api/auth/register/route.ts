import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { findPortalUserByEmail } from "@/lib/portals.server";
import { prisma } from "@/lib/prisma";
import { allocateUniqueSlug, buildSlugBase } from "@/lib/slug";
import {
  parseWithSchema,
  registerSchema,
  resolvePortalInput,
} from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = parseWithSchema(registerSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { name, email, password } = parsed.data;
    const portal = resolvePortalInput(parsed.data);

    const existing = await findPortalUserByEmail(email, portal);
    if (existing) {
      return NextResponse.json({ error: "email_taken" }, { status: 409 });
    }

    const passwordHash = await hash(password, 12);
    const slug =
      portal === "masseur"
        ? await allocateUniqueSlug(buildSlugBase([name, email.split("@")[0]]))
        : null;

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        portal,
        slug,
      },
      select: { id: true, email: true, name: true, portal: true, slug: true },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
