"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
} from "react";
import {
  THEME_COOKIE_MAX_AGE,
  THEME_STORAGE_KEY,
  isTheme,
  type Theme,
} from "@/lib/theme-prefs";

export type { Theme } from "@/lib/theme-prefs";
export { THEME_STORAGE_KEY } from "@/lib/theme-prefs";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

function persistTheme(theme: Theme) {
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  document.cookie = `${THEME_STORAGE_KEY}=${theme};path=/;max-age=${THEME_COOKIE_MAX_AGE};samesite=lax`;
}

function readStoredTheme(fallback: Theme): Theme {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (isTheme(stored)) return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : fallback;
}

let currentTheme: Theme = "light";
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function hydrateTheme(fallback: Theme) {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  currentTheme = readStoredTheme(fallback);
  applyTheme(currentTheme);
  persistTheme(currentTheme);
}

function writeTheme(theme: Theme) {
  currentTheme = theme;
  applyTheme(theme);
  persistTheme(theme);
  emit();
}

export function ThemeProvider({
  children,
  initialTheme = "light",
}: {
  children: React.ReactNode;
  initialTheme?: Theme;
}) {
  const theme = useSyncExternalStore(
    (listener) => {
      hydrateTheme(initialTheme);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => {
      hydrateTheme(initialTheme);
      return currentTheme;
    },
    () => initialTheme,
  );

  const setTheme = useCallback((next: Theme) => {
    writeTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    writeTheme(theme === "dark" ? "light" : "dark");
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
