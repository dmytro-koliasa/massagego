"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import { dictionaries, type Dictionary, type Locale } from "@/lib/i18n";

type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Dictionary;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

const LOCALE_STORAGE_KEY = "serein-locale";
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function isLocale(value: string | null | undefined): value is Locale {
  return value === "uk" || value === "en";
}

function applyLocale(locale: Locale) {
  document.documentElement.lang = locale === "uk" ? "uk" : "en";
}

function persistLocale(locale: Locale) {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  document.cookie = `${LOCALE_STORAGE_KEY}=${locale};path=/;max-age=${LOCALE_COOKIE_MAX_AGE};samesite=lax`;
}

function readStoredLocale(fallback: Locale): Locale {
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return isLocale(stored) ? stored : fallback;
}

let currentLocale: Locale = "en";
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function hydrateLocale(fallback: Locale) {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  currentLocale = readStoredLocale(fallback);
  applyLocale(currentLocale);
  persistLocale(currentLocale);
}

function writeLocale(locale: Locale) {
  currentLocale = locale;
  applyLocale(locale);
  persistLocale(locale);
  emit();
}

export function LanguageProvider({
  children,
  initialLocale = "en",
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const locale = useSyncExternalStore(
    (listener) => {
      hydrateLocale(initialLocale);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => {
      hydrateLocale(initialLocale);
      return currentLocale;
    },
    () => initialLocale,
  );

  const setLocale = useCallback((next: Locale) => {
    writeLocale(next);
  }, []);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: dictionaries[locale],
    }),
    [locale, setLocale],
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
