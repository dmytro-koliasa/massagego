"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import type { CanonicalCity } from "@/lib/city";
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
};

const DEBOUNCE_MS = 450;

export function CityAutocomplete({
  value,
  onChange,
  onSelectCity,
  placeholder,
  label,
  lang,
  required = false,
}: CityAutocompleteProps) {
  const { t } = useLanguage();
  const listId = useId();
  const wrapRef = useRef<HTMLLabelElement>(null);
  const skipFetchRef = useRef(false);
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const query = value.trim();
  const queryTooShort = query.length < CITY_QUERY_MIN;
  const shownSuggestions = queryTooShort ? [] : suggestions;
  const shownOpen = queryTooShort ? false : open;
  const shownSearched = queryTooShort ? false : searched;
  const shownLoading = queryTooShort ? false : loading;

  useEffect(() => {
    if (skipFetchRef.current) {
      skipFetchRef.current = false;
      return;
    }

    if (queryTooShort) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setSearched(false);
      void fetch(
        `/api/geocode/city?q=${encodeURIComponent(query)}&lang=${lang}`,
        { signal: controller.signal },
      )
        .then(async (response) => {
          if (!response.ok) {
            setSuggestions([]);
            setSearched(true);
            setOpen(true);
            return;
          }
          const data = (await response.json()) as {
            results?: CitySuggestion[];
          };
          setSuggestions(data.results ?? []);
          setSearched(true);
          setOpen(true);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
          setSuggestions([]);
          setSearched(true);
          setOpen(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        });
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, queryTooShort, lang]);

  function pickSuggestion(item: CitySuggestion) {
    skipFetchRef.current = true;
    onChange(item.label);
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
  }

  return (
    <label ref={wrapRef} className="relative block text-left">
      <span className="mb-1.5 block text-sm text-muted">
        {label}
        {required ? (
          <span className="text-accent" aria-hidden>
            {" "}
            *
          </span>
        ) : null}
      </span>
      <input
        type="text"
        required={required}
        role="combobox"
        aria-expanded={shownOpen && shownSuggestions.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          onSelectCity?.(null);
        }}
        onFocus={() => {
          if (shownSuggestions.length > 0 || shownSearched) setOpen(true);
        }}
        placeholder={placeholder}
        maxLength={CITY_MAX}
        className="h-12 w-full rounded-lg border border-surface-border bg-background/70 px-4 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-[var(--ring)]"
      />

      {shownOpen &&
      (shownSuggestions.length > 0 || shownLoading || shownSearched) ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-surface-border bg-surface py-1 shadow-lg"
        >
          {shownLoading && shownSuggestions.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">…</li>
          ) : shownSuggestions.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">{t.citySearchEmpty}</li>
          ) : (
            shownSuggestions.map((item) => (
              <li key={item.id} role="option">
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
    </label>
  );
}
