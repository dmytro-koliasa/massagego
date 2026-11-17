import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-session.server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const FILTERS = new Set(["all", "active", "blocked", "deleted"]);

export async function GET(request: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(request.url);
  const filterRaw = (searchParams.get("filter") ?? "all").trim().toLowerCase();
  const filter = FILTERS.has(filterRaw) ? filterRaw : "all";
  const q = (searchParams.get("q") ?? "").trim().slice(0, 80);

  const where: Prisma.UserWhereInput = {
    portal: { in: ["client", "masseur", "admin"] },
  };

  if (filter === "active") {
    where.deletedAt = null;
    where.blockedAt = null;
  } else if (filter === "blocked") {
    where.deletedAt = null;
    where.blockedAt = { not: null };
  } else if (filter === "deleted") {
    where.deletedAt = { not: null };
  }

  if (q) {
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { name: { contains: q, mode: "insensitive" } },
      { nameEn: { contains: q, mode: "insensitive" } },
      { nameUk: { contains: q, mode: "insensitive" } },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      portal: true,
      email: true,
      phone: true,
      name: true,
      nameEn: true,
      nameUk: true,
      blockedAt: true,
      deletedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ users, filter });
}
