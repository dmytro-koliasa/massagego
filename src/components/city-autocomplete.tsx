"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import type { CanonicalCity } from "@/lib/city";
import {
  portalRequestHeaders,
  type PublicPortal,
} from "@/lib/portals";
import {
  formControlClassName,
  formPrimaryButtonInlineClassName,
} from "@/lib/ui-classes";
import { CITY_MAX, CITY_QUERY_MIN } from "@/lib/validation";

type CitySuggestion = {
  id: string;
  placeId: string;
  countryCode: string;
  label: string;
  detail: string;
  nameEn: string;
  nameUk: string;
  lat: number | null;
  lon: number | null;
  timeZone?: string | null;
};

type CityAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  onSelectCity?: (city: CanonicalCity | null) => void;
  placeholder: string;
  label: string;
  lang: "en" | "uk";
  required?: boolean;
  /** Dual-session hint for authenticated profile/dashboard fetches (#113). */
  portal?: PublicPortal;
};

/**
 * Explicit city search (#113 / H2).
 * Does not call Nominatim on every keystroke — only Search / Enter.
 */
export function CityAutocomplete({
  value,
  onChange,
  onSelectCity,
  placeholder,
  label,
  lang,
  required = false,
  portal,
}: CityAutocompleteProps) {
  const { t } = useLanguage();
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [hydrated, setHydrated] = useState(false);
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  async function runSearch() {
    // Prefer controlled value; fall back to the live DOM value so automation
    // that updates the input without React onChange can still search.
    const liveQuery =
      value.trim() || inputRef.current?.value.trim() || "";
    if (liveQuery.length < CITY_QUERY_MIN || loading) {
      return;
    }

    setLoading(true);
    setSearched(false);
    setError(null);
    setOpen(true);

    try {
      const headers = portal ? portalRequestHeaders(portal) : undefined;
      const response = await fetch(
        `/api/geocode/city?q=${encodeURIComponent(liveQuery)}&lang=${lang}`,
        { headers },
      );
      if (response.status === 429) {
        const data = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        setSuggestions([]);
        setError(data?.message ?? t.citySearchRateLimited);
        setSearched(true);
        return;
      }
      if (!response.ok) {
        setSuggestions([]);
        setError(t.citySearchError);
        setSearched(true);
        return;
      }
      const data = (await response.json()) as {
        results?: CitySuggestion[];
      };
      setSuggestions(data.results ?? []);
      setSearched(true);
    } catch {
      setSuggestions([]);
      setError(t.citySearchError);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }

  function pickSuggestion(item: CitySuggestion) {
    onChange(item.label);
    if (inputRef.current) inputRef.current.value = item.label;
    onSelectCity?.({
      placeId: item.placeId,
      countryCode: item.countryCode,
      nameEn: item.nameEn || item.label,
      nameUk: item.nameUk || item.label,
      lat: item.lat,
      lon: item.lon,
      timeZone: item.timeZone ?? null,
    });
    setSuggestions([]);
    setOpen(false);
    setSearched(false);
    setError(null);
  }

  return (
    <div
      ref={wrapRef}
      className="relative block text-left"
      data-testid="city-autocomplete"
      data-hydrated={hydrated ? "true" : "false"}
    >
      <span className="mb-1.5 block text-sm text-muted">
        {label}
        {required ? (
          <span className="text-accent" aria-hidden>
            {" "}
            *
          </span>
        ) : null}
      </span>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          required={required}
          role="combobox"
          aria-expanded={open && suggestions.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          data-testid="city-search-input"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            onSelectCity?.(null);
            setSuggestions([]);
            setSearched(false);
            setError(null);
            setOpen(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void runSearch();
            }
          }}
          onFocus={() => {
            if (suggestions.length > 0 || searched || error) setOpen(true);
          }}
          placeholder={placeholder}
          maxLength={CITY_MAX}
          className={`${formControlClassName} min-w-0 flex-1`}
        />
        <button
          type="button"
          data-testid="city-search-button"
          disabled={loading}
          onClick={() => {
            void runSearch();
          }}
          className={formPrimaryButtonInlineClassName}
        >
          {loading ? t.authPleaseWait : t.citySearchAction}
        </button>
      </div>
      <p className="mt-1.5 text-xs text-muted">{t.citySearchHint}</p>

      {open && (suggestions.length > 0 || loading || searched || error) ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-surface-border bg-surface py-1 shadow-lg"
        >
          {error ? (
            <li className="px-3 py-2 text-sm text-muted">{error}</li>
          ) : loading && suggestions.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">…</li>
          ) : suggestions.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">{t.citySearchEmpty}</li>
          ) : (
            suggestions.map((item) => (
              <li
                key={item.id}
                role="option"
                aria-selected={
                  item.label === value ||
                  item.nameEn === value ||
                  item.nameUk === value
                }
              >
                <button
                  type="button"
                  className="flex w-full flex-col gap-0.5 px-3 py-2 text-left transition hover:bg-accent-soft"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pickSuggestion(item)}
                >
                  <span className="text-sm text-foreground">{item.label}</span>
                  <span className="text-xs text-muted">{item.detail}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
