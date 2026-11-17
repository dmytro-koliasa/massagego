import { NextResponse } from "next/server";
import { auth } from "@/auth/client";
import { cityDisplayName, cityFilterKey } from "@/lib/city";
import { isExcludedCountryCode } from "@/lib/phone-countries";
import { userHasPortal } from "@/lib/portals.server";
import { prisma } from "@/lib/prisma";
import { CITY_MAX } from "@/lib/validation";

const DEFAULT_PAGE_SIZE = 9;
const MAX_PAGE_SIZE = 50;

const masseurSelect = {
  id: true,
  slug: true,
  nameEn: true,
  nameUk: true,
  image: true,
  descriptionEn: true,
  descriptionUk: true,
  city: true,
  cityPlaceId: true,
  cityCountryCode: true,
  cityNameEn: true,
  cityNameUk: true,
  createdAt: true,
} as const;

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const allowed = await userHasPortal(session.user.id, "client");
  if (!allowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const clientUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      cityPlaceId: true,
      city: true,
      cityNameEn: true,
      cityNameUk: true,
      preferredLocale: true,
    },
  });

  const { searchParams } = new URL(request.url);
  const pageRaw = Number(searchParams.get("page") ?? "1");
  const pageSizeRaw = Number(
    searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE),
  );
  const cityParam = searchParams.get("city")?.trim() ?? "";
  const locale = clientUser?.preferredLocale === "uk" ? "uk" : "en";

  const page =
    Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const pageSize = Number.isFinite(pageSizeRaw)
    ? Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(pageSizeRaw)))
    : DEFAULT_PAGE_SIZE;

  const defaultCityKey = clientUser
    ? cityFilterKey(clientUser).replace(/^id:/, "").replace(/^name:/, "")
    : "";
  const defaultFilterValue = clientUser?.cityPlaceId?.trim()
    ? `id:${clientUser.cityPlaceId.trim()}`
    : clientUser?.city?.trim()
      ? `name:${clientUser.city.trim()}`
      : "all";

  const requested =
    cityParam && cityParam !== "all"
      ? cityParam.slice(0, CITY_MAX + 8)
      : cityParam === "all"
        ? "all"
        : defaultFilterValue;

  const where =
    requested === "all" || !requested
      ? { portal: "masseur" as const }
      : requested.startsWith("id:")
        ? {
            portal: "masseur" as const,
            cityPlaceId: requested.slice(3),
          }
        : requested.startsWith("name:")
          ? {
              portal: "masseur" as const,
              city: requested.slice(5),
            }
          : {
              portal: "masseur" as const,
              OR: [{ cityPlaceId: requested }, { city: requested }],
            };

  const [total, totalAll, cityRows, masseurs] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.count({ where: { portal: "masseur" } }),
    prisma.user.findMany({
      where: {
        portal: "masseur",
        OR: [{ cityPlaceId: { not: null } }, { city: { not: null } }],
      },
      select: {
        city: true,
        cityPlaceId: true,
        cityCountryCode: true,
        cityNameEn: true,
        cityNameUk: true,
      },
    }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: masseurSelect,
    }),
  ]);

  const cityMap = new Map<string, string>();
  for (const row of cityRows) {
    if (
      row.cityCountryCode &&
      isExcludedCountryCode(row.cityCountryCode)
    ) {
      continue;
    }
    const key = cityFilterKey(row);
    if (!key) continue;
    const label = cityDisplayName(row, locale);
    if (!label) continue;
    if (!cityMap.has(key)) cityMap.set(key, label);
  }

  const cities = [...cityMap.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) =>
      a.label.localeCompare(b.label, locale === "uk" ? "uk" : "en", {
        sensitivity: "base",
      }),
    );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  const pageMasseurs =
    safePage === page
      ? masseurs
      : await prisma.user.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (safePage - 1) * pageSize,
          take: pageSize,
          select: masseurSelect,
        });

  return NextResponse.json({
    masseurs: pageMasseurs.map((masseur) => ({
      ...masseur,
      cityLabel: cityDisplayName(masseur, locale),
    })),
    page: safePage,
    pageSize,
    total,
    totalAll,
    totalPages,
    cities,
    cityFilter: requested || "all",
    defaultCityFilter: defaultFilterValue,
    clientCityKey: defaultCityKey || null,
    clientCityLabel: clientUser ? cityDisplayName(clientUser, locale) : null,
  });
}
