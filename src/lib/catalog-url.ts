/**
 * Client/server helpers for catalog city + page URL state (#207 AD-3).
 * City identifiers match GET /api/masseurs (`all`, `id:…`, `name:…`).
 */

export function buildClientCatalogHref(options: {
  city: string;
  page: number;
}): string {
  const params = new URLSearchParams();
  const city = options.city.trim();
  if (city === "all") {
    params.set("city", "all");
  } else if (city) {
    params.set("city", city);
  }
  if (options.page > 1) {
    params.set("page", String(options.page));
  }
  const qs = params.toString();
  return qs ? `/client?${qs}` : "/client";
}

export function parseCatalogSearchParams(input: {
  city?: string | string[] | undefined;
  page?: string | string[] | undefined;
}): { city: string | null; page: string | null } {
  const cityRaw = Array.isArray(input.city) ? input.city[0] : input.city;
  const pageRaw = Array.isArray(input.page) ? input.page[0] : input.page;
  return {
    city: cityRaw?.trim() ? cityRaw.trim() : null,
    page: pageRaw?.trim() ? pageRaw.trim() : null,
  };
}
