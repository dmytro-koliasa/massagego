import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import {
  findPortalUserByEmail,
  findPortalUserByPhone,
} from "@/lib/portals.server";
import { clientEmailFromPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { allocateUniqueSlug, buildSlugBase } from "@/lib/slug";
import {
  clientRegisterSchema,
  parseWithSchema,
  registerSchema,
  resolvePortalInput,
} from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const portal = resolvePortalInput(body);

    if (portal === "client") {
      const parsed = parseWithSchema(clientRegisterSchema, body);
      if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }

      const { name, phone, password } = parsed.data;
      const existing = await findPortalUserByPhone(phone, "client");
      if (existing) {
        return NextResponse.json({ error: "phone_taken" }, { status: 409 });
      }

      const email = clientEmailFromPhone(phone);
      const emailTaken = await findPortalUserByEmail(email, "client");
      if (emailTaken) {
        return NextResponse.json({ error: "phone_taken" }, { status: 409 });
      }

      const passwordHash = await hash(password, 12);
      const user = await prisma.user.create({
        data: {
          name,
          email,
          phone,
          passwordHash,
          portal: "client",
          slug: null,
        },
        select: {
          id: true,
          email: true,
          phone: true,
          name: true,
          portal: true,
          slug: true,
        },
      });

      return NextResponse.json({ user }, { status: 201 });
    }

    const parsed = parseWithSchema(registerSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { name, email, password } = parsed.data;

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
