"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useLanguage } from "@/components/language-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Portal } from "@/lib/portals";

function resolvePortal(pathname: string | null): Portal {
  if (pathname?.startsWith("/client")) return "client";
  return "masseur";
}

function initialsFromName(
  name: string | null | undefined,
  email?: string | null,
) {
  const source = name?.trim() || email?.trim() || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function SiteHeader() {
  const { t, locale } = useLanguage();
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const portal = resolvePortal(pathname);
  const isHome = pathname === "/";

  const signOutTarget = pathname.startsWith("/client")
    ? "/client"
    : pathname.startsWith("/masseur")
      ? "/masseur"
      : "/";

  const portalLabel =
    portal === "client" ? t.headerPortalClient : t.headerPortalMasseur;
  const localizedName =
    (locale === "uk" ? session?.user?.nameUk : session?.user?.nameEn)?.trim() ||
    (locale === "uk" ? session?.user?.nameEn : session?.user?.nameUk)?.trim() ||
    session?.user?.name?.trim() ||
    "";
  const displayName =
    localizedName ||
    session?.user?.email?.trim() ||
    t.masseurFallbackName;

  return (
    <header
      className={`sticky top-0 z-50 border-b backdrop-blur-xl ${
        isHome
          ? "border-white/10 bg-[#101110]/55 text-white"
          : "border-surface-border bg-background/80 text-foreground"
      }`}
    >
      <div className="mx-auto flex h-[4.25rem] w-full max-w-6xl items-center justify-between gap-4 px-[15px]">
        <Link
          href="/"
          className={`font-display text-[1.65rem] leading-none tracking-[-0.03em] transition hover:opacity-80 ${
            isHome ? "text-white" : "text-foreground"
          }`}
        >
          MassageGo
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher tone={isHome ? "onDark" : "default"} />
          <ThemeToggle tone={isHome ? "onDark" : "default"} />

          {isHome ? null : status === "loading" ? (
            <span className="h-11 w-36 animate-pulse rounded-lg bg-accent-soft" />
          ) : session?.user ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden min-w-0 text-right sm:block">
                <p className="truncate text-sm font-medium tracking-[0.01em] text-foreground">
                  {displayName}
                </p>
                <p className="text-xs text-muted">{portalLabel}</p>
              </div>

              <div
                className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-surface-border bg-accent-soft"
                title={`${displayName} · ${portalLabel}`}
              >
                {session.user.image ? (
                  <Image
                    key={session.user.image}
                    src={session.user.image}
                    alt=""
                    fill
                    sizes="44px"
                    className="object-cover"
                    unoptimized={session.user.image.startsWith("/uploads/")}
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-xs font-semibold tracking-[0.04em] text-foreground">
                    {initialsFromName(localizedName || session.user.name, session.user.email)}
                  </span>
                )}
              </div>

              <span className="rounded-lg bg-accent-soft px-3 py-1.5 text-sm font-medium tracking-[0.02em] text-muted sm:hidden">
                {portalLabel}
              </span>

              <button
                type="button"
                onClick={() => signOut({ callbackUrl: signOutTarget })}
                className="flex h-11 items-center rounded-lg border border-surface-border bg-surface px-4 text-sm font-medium tracking-[0.02em] text-foreground transition hover:border-accent/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                {t.dashboardSignOut}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
