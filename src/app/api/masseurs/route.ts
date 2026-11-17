import { NextResponse } from "next/server";
import { auth } from "@/auth/client";
import { cityDisplayName, cityFilterKey } from "@/lib/city";
import {
  availabilityLabelForNearest,
  compareMasseurCatalogOrder,
  findNearestFreeSlots,
  listedMasseurWhere,
  type CatalogLocale,
} from "@/lib/masseur-catalog";
import { isExcludedCountryCode } from "@/lib/phone-countries";
import { userHasPortal } from "@/lib/portals.server";
import { prisma } from "@/lib/prisma";
import { CITY_MAX } from "@/lib/validation";
import type { Prisma } from "@prisma/client";

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
  timezone: true,
  bookingLeadHours: true,
  createdAt: true,
} as const;

function cityFilterWhere(
  requested: string,
): Prisma.UserWhereInput | undefined {
  if (requested === "all" || !requested) return undefined;
  if (requested.startsWith("id:")) {
    return { cityPlaceId: requested.slice(3) };
  }
  if (requested.startsWith("name:")) {
    return { city: requested.slice(5) };
  }
  return { OR: [{ cityPlaceId: requested }, { city: requested }] };
}

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
  const locale: CatalogLocale =
    clientUser?.preferredLocale === "uk" ? "uk" : "en";

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

  const cityWhere = cityFilterWhere(requested);
  const listedBase: Prisma.UserWhereInput = {
    portal: "masseur",
    ...listedMasseurWhere,
  };
  const where: Prisma.UserWhereInput = cityWhere
    ? { AND: [listedBase, cityWhere] }
    : listedBase;

  const [totalAll, cityRows, candidates] = await Promise.all([
    prisma.user.count({ where: listedBase }),
    prisma.user.findMany({
      where: listedBase,
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
      select: masseurSelect,
    }),
  ]);

  const nearestById = await findNearestFreeSlots(
    candidates.map((masseur) => ({
      id: masseur.id,
      timezone: masseur.timezone,
      bookingLeadHours: masseur.bookingLeadHours,
    })),
  );

  const now = new Date();
  const ranked = candidates
    .map((masseur) => {
      const nearestFreeAt = nearestById.get(masseur.id) ?? null;
      const hasFreeTime = nearestFreeAt !== null;
      return {
        masseur,
        nearestFreeAt,
        hasFreeTime,
        availabilityLabel: availabilityLabelForNearest(
          nearestFreeAt,
          masseur.timezone,
          locale,
          now,
        ),
      };
    })
    .sort((a, b) =>
      compareMasseurCatalogOrder(
        { hasFreeTime: a.hasFreeTime, createdAt: a.masseur.createdAt },
        { hasFreeTime: b.hasFreeTime, createdAt: b.masseur.createdAt },
      ),
    );

  const total = ranked.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageSlice = ranked.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

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

  return NextResponse.json({
    masseurs: pageSlice.map(
      ({ masseur, nearestFreeAt, hasFreeTime, availabilityLabel }) => {
        const {
          timezone: _timezone,
          bookingLeadHours: _bookingLeadHours,
          ...card
        } = masseur;
        return {
          ...card,
          cityLabel: cityDisplayName(masseur, locale),
          nearestFreeAt: nearestFreeAt?.toISOString() ?? null,
          hasFreeTime,
          availabilityLabel,
        };
      },
    ),
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
