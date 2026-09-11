import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { isPortal, type Portal } from "@/lib/portals";
import { findPortalUserByEmail } from "@/lib/portals.server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email =
      typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const portal: Portal = isPortal(body.role)
      ? body.role
      : isPortal(body.portal)
        ? body.portal
        : "masseur";

    if (!name || !email || !password) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "weak_password" }, { status: 400 });
    }

    const existing = await findPortalUserByEmail(email, portal);
    if (existing) {
      return NextResponse.json({ error: "email_taken" }, { status: 409 });
    }

    const passwordHash = await hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        portal,
      },
      select: { id: true, email: true, name: true, portal: true },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
