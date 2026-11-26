import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import {
	buildPublicSiteUrl,
	resolvePublicSiteOrigin,
} from "@/lib/seo/site-origin";

export type PublicPath = "/" | "/privacy" | "/terms";

const pages = {
	"/": {
		en: {
			title: "MassageGo — Massage for masseurs and clients",
			description:
				"A calm place for masseurs and clients to meet. Sign in as a masseur for your personal page, or continue as a client.",
		},
		uk: {
			title: "MassageGo — масаж для масажистів і клієнтів",
			description:
				"Спокійне місце, де зустрічаються масажисти та клієнти — оберіть свій шлях, щоб почати.",
		},
	},
	"/privacy": {
		en: {
			title: "Privacy Policy — MassageGo",
			description:
				"How MassageGo collects and uses personal data for accounts, bookings, and notifications.",
		},
		uk: {
			title: "Політика конфіденційності — MassageGo",
			description:
				"Як MassageGo збирає та використовує персональні дані для акаунтів, бронювань і сповіщень.",
		},
	},
	"/terms": {
		en: {
			title: "Terms of Service — MassageGo",
			description:
				"Terms for using MassageGo as a masseur or client, including accounts, bookings, and notifications.",
		},
		uk: {
			title: "Умови використання — MassageGo",
			description:
				"Умови користування MassageGo для масажистів і клієнтів: акаунти, бронювання та сповіщення.",
		},
	},
} as const;

export function readLocaleCookie(value: string | undefined): Locale {
	return value === "uk" || value === "en" ? value : "en";
}

export function publicPageCopy(path: PublicPath, locale: Locale) {
	return pages[path][locale];
}

/** Root layout defaults (English marketing). Route pages override via generateMetadata. */
export function rootMetadata(): Metadata {
	const home = pages["/"]["en"];
	const origin = resolvePublicSiteOrigin();
	return {
		...(origin.ok ? { metadataBase: new URL(origin.origin) } : {}),
		title: home.title,
		description: home.description,
		robots: { index: true, follow: true },
	};
}

export function publicPageMetadata(
	path: PublicPath,
	locale: Locale,
): Metadata {
	const copy = publicPageCopy(path, locale);
	const origin = resolvePublicSiteOrigin();
	const canonicalPath = path === "/" ? "/" : path;

	return {
		title: copy.title,
		description: copy.description,
		alternates: {
			canonical: origin.ok
				? buildPublicSiteUrl(origin.origin, canonicalPath)
				: canonicalPath,
		},
		robots: { index: true, follow: true },
	};
}

/** Auth / portal surfaces: discoverable for noindex, never in sitemap. */
export const portalRobots: Metadata["robots"] = {
	index: false,
	follow: false,
	nocache: true,
	googleBot: {
		index: false,
		follow: false,
		noimageindex: true,
	},
};
