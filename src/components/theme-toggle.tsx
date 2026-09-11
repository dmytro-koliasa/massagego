"use client";

import { useTheme } from "@/components/theme-provider";

type Tone = "default" | "onDark";

export function ThemeToggle({ tone = "default" }: { tone?: Tone }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const onDark = tone === "onDark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className={`relative flex h-11 w-11 items-center justify-center rounded-lg border transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
        onDark
          ? "border-white/20 bg-white/10 text-white hover:bg-white/16"
          : "border-surface-border bg-accent-soft text-foreground hover:border-accent/30"
      }`}
    >
      <span
        className={`absolute transition duration-300 ${
          isDark
            ? "scale-0 rotate-90 opacity-0"
            : "scale-100 rotate-0 opacity-100"
        }`}
        aria-hidden
      >
        <SunIcon />
      </span>
      <span
        className={`absolute transition duration-300 ${
          isDark
            ? "scale-100 rotate-0 opacity-100"
            : "scale-0 -rotate-90 opacity-0"
        }`}
        aria-hidden
      >
        <MoonIcon />
      </span>
    </button>
  );
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M19.5 13.4A7.6 7.6 0 0 1 10.6 4.5 7.8 7.8 0 1 0 19.5 13.4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
