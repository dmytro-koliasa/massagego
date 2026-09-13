"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { useLanguage } from "@/components/language-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Preloader } from "@/components/preloader";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Portal } from "@/lib/portals";
import { portalHomePath } from "@/lib/portals";
import { shouldSkipImageOptimization } from "@/lib/upload-url";

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

function HeaderNavLink({
  href,
  label,
  active,
  onDark,
}: {
  href: string;
  label: string;
  active: boolean;
  onDark: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-lg px-2.5 py-2 text-sm font-medium tracking-[0.02em] transition sm:px-3 ${
        onDark
          ? active
            ? "bg-white/12 text-white"
            : "text-white/72 hover:bg-white/8 hover:text-white"
          : active
            ? "bg-accent-soft text-foreground"
            : "text-muted hover:bg-accent-soft/70 hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
}

export function SiteHeader() {
  const { t, locale } = useLanguage();
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const portal = resolvePortal(pathname);
  const isHome = pathname === "/";
  const [signingOut, setSigningOut] = useState(false);

  const signOutTarget = pathname.startsWith("/client")
    ? portalHomePath("client")
    : pathname.startsWith("/masseur")
      ? portalHomePath("masseur")
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

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    await signOut({ callbackUrl: signOutTarget });
  }

  return (
    <>
      <header
        className={`sticky top-0 z-50 border-b backdrop-blur-xl ${
          isHome
            ? "border-white/10 bg-[#101110]/55 text-white"
            : "border-surface-border bg-background/80 text-foreground"
        }`}
      >
        <div className="mx-auto flex h-[4.25rem] w-full max-w-6xl items-center justify-between gap-4 px-[15px]">
          <div className="flex min-w-0 items-center gap-4 sm:gap-6">
            <Link
              href="/"
              className={`shrink-0 font-display text-[1.65rem] leading-none tracking-[-0.03em] transition hover:opacity-80 ${
                isHome ? "text-white" : "text-foreground"
              }`}
            >
              MassageGo
            </Link>

            <nav
              aria-label={t.roleGroupLabel}
              className="mt-1.5 flex items-center gap-1 sm:gap-2"
            >
              <HeaderNavLink
                href="/masseur"
                label={t.masseurTitle}
                active={pathname.startsWith("/masseur")}
                onDark={isHome}
              />
              <HeaderNavLink
                href="/client/login"
                label={t.clientTitle}
                active={pathname.startsWith("/client")}
                onDark={isHome}
              />
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
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
                      unoptimized={shouldSkipImageOptimization(session.user.image)}
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs font-semibold tracking-[0.04em] text-foreground">
                      {initialsFromName(
                        localizedName || session.user.name,
                        session.user.email,
                      )}
                    </span>
                  )}
                </div>

                <span className="rounded-lg bg-accent-soft px-3 py-1.5 text-sm font-medium tracking-[0.02em] text-muted sm:hidden">
                  {portalLabel}
                </span>

                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="flex h-11 items-center rounded-lg border border-surface-border bg-surface px-4 text-sm font-medium tracking-[0.02em] text-foreground transition hover:border-accent/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {t.dashboardSignOut}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {signingOut ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background">
          <Preloader label={t.authPleaseWait} />
        </div>
      ) : null}
    </>
  );
}
