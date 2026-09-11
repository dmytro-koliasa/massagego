import { NextResponse } from "next/server";
import { auth } from "@/auth/client";
import { userHasPortal } from "@/lib/portals.server";
import { prisma } from "@/lib/prisma";

const DEFAULT_PAGE_SIZE = 9;
const MAX_PAGE_SIZE = 50;

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const allowed = await userHasPortal(session.user.id, "client");
  if (!allowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const pageRaw = Number(searchParams.get("page") ?? "1");
  const pageSizeRaw = Number(
    searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE),
  );
  const cityParam = searchParams.get("city")?.trim() ?? "";

  const page =
    Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const pageSize = Number.isFinite(pageSizeRaw)
    ? Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(pageSizeRaw)))
    : DEFAULT_PAGE_SIZE;

  const cityFilter =
    cityParam && cityParam !== "all" ? cityParam.slice(0, 120) : null;

  const where = {
    portal: "masseur" as const,
    ...(cityFilter ? { city: cityFilter } : {}),
  };

  const [total, totalAll, cityRows, masseurs] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.count({ where: { portal: "masseur" } }),
    prisma.user.findMany({
      where: {
        portal: "masseur",
        city: { not: null },
      },
      select: { city: true },
      distinct: ["city"],
      orderBy: { city: "asc" },
    }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        nameEn: true,
        nameUk: true,
        email: true,
        image: true,
        descriptionEn: true,
        descriptionUk: true,
        city: true,
        createdAt: true,
      },
    }),
  ]);

  const cities = cityRows
    .map((row) => row.city?.trim() ?? "")
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "uk", { sensitivity: "base" }));

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  // If client asked for a page past the end, return the last page.
  const pageMasseurs =
    safePage === page
      ? masseurs
      : await prisma.user.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (safePage - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            nameEn: true,
            nameUk: true,
            email: true,
            image: true,
            descriptionEn: true,
            descriptionUk: true,
            city: true,
            createdAt: true,
          },
        });

  return NextResponse.json({
    masseurs: pageMasseurs,
    page: safePage,
    pageSize,
    total,
    totalAll,
    totalPages,
    cities,
  });
}
