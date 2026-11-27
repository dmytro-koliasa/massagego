"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLanguage } from "@/components/language-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTheme } from "@/components/theme-provider";

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

/**
 * Marketing chrome (#206): no next-auth / useSession.
 * Portal header with session UI remains `SiteHeader`.
 * Home relies on hero CTAs for portal entry (#190); privacy/terms keep login nav.
 */
export function SiteHeaderMarketing() {
	const { t } = useLanguage();
	const { theme } = useTheme();
	const pathname = usePathname();
	const isHome = pathname === "/";
	const homeOnDark = isHome && theme === "dark";
	const showPortalNav = !isHome;

	return (
		<header
			className={`sticky top-0 z-50 border-b backdrop-blur-xl ${
				homeOnDark
					? "border-[rgba(240,171,252,0.18)] bg-[rgba(5,5,10,0.42)] text-white"
					: isHome
						? "border-[var(--landing-border)] bg-[color-mix(in_srgb,var(--landing-bg)_55%,transparent)] text-[var(--landing-fg)]"
						: "border-surface-border bg-background/80 text-foreground"
			}`}
		>
			<div className="mx-auto flex h-[4.25rem] w-full max-w-6xl items-center justify-between gap-4 px-[15px]">
				<div className="flex min-w-0 items-center gap-4 sm:gap-6">
					<Link
						href="/"
						className={`inline-flex min-h-11 shrink-0 items-center font-display text-[1.65rem] leading-none tracking-[-0.03em] transition hover:opacity-80 ${
							homeOnDark
								? "text-white"
								: isHome
									? "text-[var(--landing-title)]"
									: "text-foreground"
						}`}
					>
						MassageGo
					</Link>

					{showPortalNav ? (
						<nav
							aria-label={t.roleGroupLabel}
							className="mt-1.5 flex items-center gap-1 sm:gap-2"
						>
							<HeaderNavLink
								href="/masseur/login"
								label={t.masseurTitle}
								active={pathname.startsWith("/masseur")}
								onDark={homeOnDark}
							/>
							<HeaderNavLink
								href="/client/login"
								label={t.clientTitle}
								active={pathname.startsWith("/client")}
								onDark={homeOnDark}
							/>
						</nav>
					) : null}
				</div>

				<div className="flex shrink-0 items-center gap-2 sm:gap-3">
					<LanguageSwitcher tone={homeOnDark ? "onDark" : "default"} />
					<ThemeToggle tone={homeOnDark ? "onDark" : "default"} />
				</div>
			</div>
		</header>
	);
}
