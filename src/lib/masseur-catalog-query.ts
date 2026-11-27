import "server-only";

import { cityDisplayName, cityFilterKey } from "@/lib/city";
import {
  availabilityLabelForNearest,
  compareMasseurCatalogOrder,
  findNearestFreeSlots,
  listedMasseurWhere,
  type CatalogLocale,
} from "@/lib/masseur-catalog";
import { isExcludedCountryCode } from "@/lib/phone-countries";
import { prisma } from "@/lib/prisma";
import { CITY_MAX } from "@/lib/validation";
import type { Prisma } from "@/generated/prisma/client";

export const CATALOG_DEFAULT_PAGE_SIZE = 9;
export const CATALOG_MAX_PAGE_SIZE = 50;

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

export type MasseurCatalogCardDto = {
  id: string;
  slug: string | null;
  nameEn: string | null;
  nameUk: string | null;
  image: string | null;
  descriptionEn: string | null;
  descriptionUk: string | null;
  city: string | null;
  cityPlaceId: string | null;
  cityCountryCode: string | null;
  cityNameEn: string | null;
  cityNameUk: string | null;
  createdAt: Date;
  cityLabel: string;
  nearestFreeAt: string | null;
  hasFreeTime: boolean;
  availabilityLabel: string;
};

export type MasseurCatalogResult = {
  masseurs: MasseurCatalogCardDto[];
  page: number;
  pageSize: number;
  total: number;
  totalAll: number;
  totalPages: number;
  cities: Array<{ value: string; label: string }>;
  cityFilter: string;
  defaultCityFilter: string;
  clientCityKey: string | null;
  clientCityLabel: string | null;
};

export type CatalogQueryInput = {
  page?: number | string | null;
  pageSize?: number | string | null;
  city?: string | null;
};

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

export function normalizeCatalogQuery(
  input: CatalogQueryInput,
  defaults: { defaultFilterValue: string },
): { page: number; pageSize: number; requestedCity: string } {
  const pageRaw = Number(input.page ?? "1");
  const pageSizeRaw = Number(
    input.pageSize ?? String(CATALOG_DEFAULT_PAGE_SIZE),
  );
  const cityParam = input.city?.trim() ?? "";

  const page =
    Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const pageSize = Number.isFinite(pageSizeRaw)
    ? Math.min(CATALOG_MAX_PAGE_SIZE, Math.max(1, Math.floor(pageSizeRaw)))
    : CATALOG_DEFAULT_PAGE_SIZE;

  const requested =
    cityParam && cityParam !== "all"
      ? cityParam.slice(0, CITY_MAX + 8)
      : cityParam === "all"
        ? "all"
        : defaults.defaultFilterValue;

  return { page, pageSize, requestedCity: requested };
}

/**
 * Shared masseur catalog query (#207 AD-2). Used by RSC seed and GET /api/masseurs.
 * Authorization must be enforced by the caller.
 */
export async function queryMasseurCatalog(options: {
  clientUserId: string;
  page?: number | string | null;
  pageSize?: number | string | null;
  city?: string | null;
}): Promise<MasseurCatalogResult> {
  const clientUser = await prisma.user.findUnique({
    where: { id: options.clientUserId },
    select: {
      cityPlaceId: true,
      city: true,
      cityNameEn: true,
      cityNameUk: true,
      preferredLocale: true,
    },
  });

  const locale: CatalogLocale =
    clientUser?.preferredLocale === "uk" ? "uk" : "en";

  const defaultCityKey = clientUser
    ? cityFilterKey(clientUser).replace(/^id:/, "").replace(/^name:/, "")
    : "";
  const defaultFilterValue = clientUser?.cityPlaceId?.trim()
    ? `id:${clientUser.cityPlaceId.trim()}`
    : clientUser?.city?.trim()
      ? `name:${clientUser.city.trim()}`
      : "all";

  const { page, pageSize, requestedCity } = normalizeCatalogQuery(
    {
      page: options.page,
      pageSize: options.pageSize,
      city: options.city,
    },
    { defaultFilterValue },
  );

  const cityWhere = cityFilterWhere(requestedCity);
  const listedBase: Prisma.UserWhereInput = {
    portal: "masseur",
    ...listedMasseurWhere,
  };
  const where: Prisma.UserWhereInput = cityWhere
    ? { AND: [listedBase, cityWhere] }
    : listedBase;

  const [totalAll, cityRows, rankingRows] = await Promise.all([
    prisma.user.count({ where: listedBase }),
    prisma.user.findMany({
      where: listedBase,
      distinct: ["cityPlaceId"],
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
      select: {
        id: true,
        timezone: true,
        bookingLeadHours: true,
        createdAt: true,
      },
    }),
  ]);

  const nearestById = await findNearestFreeSlots(
    rankingRows.map((masseur) => ({
      id: masseur.id,
      timezone: masseur.timezone,
      bookingLeadHours: masseur.bookingLeadHours,
    })),
  );

  const now = new Date();
  const ranked = rankingRows
    .map((masseur) => {
      const nearestFreeAt = nearestById.get(masseur.id) ?? null;
      const hasFreeTime = nearestFreeAt !== null;
      return {
        id: masseur.id,
        timezone: masseur.timezone,
        createdAt: masseur.createdAt,
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
        { hasFreeTime: a.hasFreeTime, createdAt: a.createdAt },
        { hasFreeTime: b.hasFreeTime, createdAt: b.createdAt },
      ),
    );

  const total = ranked.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageSlice = ranked.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );
  const pageIds = pageSlice.map((row) => row.id);

  const pageCards =
    pageIds.length === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: pageIds } },
          select: masseurSelect,
        });
  const cardById = new Map(pageCards.map((card) => [card.id, card]));

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

  return {
    masseurs: pageSlice.flatMap((row) => {
      const masseur = cardById.get(row.id);
      if (!masseur) return [];
      const { timezone, bookingLeadHours, ...card } = masseur;
      void timezone;
      void bookingLeadHours;
      return [
        {
          ...card,
          cityLabel: cityDisplayName(masseur, locale),
          nearestFreeAt: row.nearestFreeAt?.toISOString() ?? null,
          hasFreeTime: row.hasFreeTime,
          availabilityLabel: row.availabilityLabel,
        },
      ];
    }),
    page: safePage,
    pageSize,
    total,
    totalAll,
    totalPages,
    cities,
    cityFilter: requestedCity || "all",
    defaultCityFilter: defaultFilterValue,
    clientCityKey: defaultCityKey || null,
    clientCityLabel: clientUser ? cityDisplayName(clientUser, locale) : null,
  };
}

/** JSON-serializable catalog DTO for RSC → client (Date → ISO). */
export function serializeMasseurCatalog(
  result: MasseurCatalogResult,
): Omit<MasseurCatalogResult, "masseurs"> & {
  masseurs: Array<
    Omit<MasseurCatalogCardDto, "createdAt"> & { createdAt: string }
  >;
} {
  return {
    ...result,
    masseurs: result.masseurs.map((m) => ({
      ...m,
      createdAt:
        m.createdAt instanceof Date
          ? m.createdAt.toISOString()
          : String(m.createdAt),
    })),
  };
}
