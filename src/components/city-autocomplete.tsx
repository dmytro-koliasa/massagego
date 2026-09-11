"use client";

import { useEffect, useId, useRef, useState } from "react";

type CitySuggestion = {
  id: string;
  label: string;
  detail: string;
};

type CityAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  lang: "en" | "uk";
  required?: boolean;
};

const DEBOUNCE_MS = 450;
const MIN_QUERY_LENGTH = 2;

export function CityAutocomplete({
  value,
  onChange,
  placeholder,
  label,
  lang,
  required = false,
}: CityAutocompleteProps) {
  const listId = useId();
  const wrapRef = useRef<HTMLLabelElement>(null);
  const skipFetchRef = useRef(false);
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  useEffect(() => {
    if (skipFetchRef.current) {
      skipFetchRef.current = false;
      setSuggestions([]);
      setOpen(false);
      return;
    }

    const query = value.trim();
    if (query.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      void fetch(
        `/api/geocode/city?q=${encodeURIComponent(query)}&lang=${lang}`,
        { signal: controller.signal },
      )
        .then(async (response) => {
          if (!response.ok) {
            setSuggestions([]);
            return;
          }
          const data = (await response.json()) as {
            results?: CitySuggestion[];
          };
          setSuggestions(data.results ?? []);
          setOpen(true);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
          setSuggestions([]);
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
  }, [value, lang]);

  function pickSuggestion(item: CitySuggestion) {
    skipFetchRef.current = true;
    onChange(item.label);
    setSuggestions([]);
    setOpen(false);
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
        aria-expanded={open && suggestions.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        placeholder={placeholder}
        maxLength={120}
        className="h-12 w-full rounded-lg border border-surface-border bg-background/70 px-4 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-[var(--ring)]"
      />

      {open && (suggestions.length > 0 || loading) ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-surface-border bg-surface py-1 shadow-lg"
        >
          {loading && suggestions.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">…</li>
          ) : (
            suggestions.map((item) => (
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
