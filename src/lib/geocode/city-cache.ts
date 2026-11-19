/**
 * In-process TTL cache for city geocode responses (#113).
 * Reduces Nominatim traffic; not shared across instances.
 */

export type CityGeocodeCacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 500;

export function normalizeCityQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

export function cityGeocodeCacheKey(q: string, lang: "en" | "uk"): string {
  return `${lang}:${normalizeCityQuery(q)}`;
}

export function createCityGeocodeCache<T>(options?: {
  ttlMs?: number;
  maxEntries?: number;
}) {
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  const maxEntries = options?.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const store = new Map<string, CityGeocodeCacheEntry<T>>();

  function get(key: string, now = Date.now()): T | undefined {
    const hit = store.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= now) {
      store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  function set(key: string, value: T, now = Date.now()): void {
    if (store.size >= maxEntries) {
      const oldest = store.keys().next().value;
      if (oldest !== undefined) store.delete(oldest);
    }
    store.set(key, { expiresAt: now + ttlMs, value });
  }

  function clear(): void {
    store.clear();
  }

  function size(): number {
    return store.size;
  }

  return { get, set, clear, size, ttlMs };
}

export const cityGeocodeResultCache = createCityGeocodeCache<unknown>();
