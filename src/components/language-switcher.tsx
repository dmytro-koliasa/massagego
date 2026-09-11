"use client";

import { useLanguage } from "@/components/language-provider";

type Tone = "default" | "onDark";

export function LanguageSwitcher({ tone = "default" }: { tone?: Tone }) {
  const { locale, setLocale, t } = useLanguage();
  const onDark = tone === "onDark";

  return (
    <div
      role="group"
      aria-label={t.languageLabel}
      className={`inline-flex h-11 items-stretch rounded-lg p-0.5 ${
        onDark
          ? "border border-white/20 bg-white/10 text-white"
          : "border border-surface-border bg-accent-soft text-foreground"
      }`}
    >
      <LangOption
        active={locale === "uk"}
        label={t.ukrainian}
        onSelect={() => setLocale("uk")}
        onDark={onDark}
      />
      <LangOption
        active={locale === "en"}
        label={t.english}
        onSelect={() => setLocale("en")}
        onDark={onDark}
      />
    </div>
  );
}

function LangOption({
  active,
  label,
  onSelect,
  onDark,
}: {
  active: boolean;
  label: string;
  onSelect: () => void;
  onDark: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`rounded-md px-3.5 text-sm font-medium tracking-[0.04em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
        active
          ? onDark
            ? "bg-white text-[#141413]"
            : "bg-surface text-foreground shadow-sm"
          : onDark
            ? "text-white/70 hover:text-white"
            : "text-muted hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
