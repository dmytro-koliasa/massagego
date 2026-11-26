/**
 * Public site origin for SEO (`metadataBase`, sitemap, robots Sitemap line).
 *
 * Prefer `SITE_URL` (canonical public website origin). Fall back to `AUTH_URL`
 * when the app is served from a single host (README deploy convention).
 * Never invent a production hostname in source.
 */

export type SiteOriginEnv = {
	readonly [key: string]: string | undefined;
};

export type SiteOriginResult =
	| { ok: true; origin: string; source: "SITE_URL" | "AUTH_URL" }
	| { ok: false; error: "site_origin_missing" | "site_origin_invalid" };

function parseOrigin(raw: string): string | null {
	let parsed: URL;
	try {
		parsed = new URL(raw);
	} catch {
		return null;
	}
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		return null;
	}
	return parsed.origin;
}

/**
 * Resolve the public site origin for absolute SEO URLs.
 * Trailing slashes and path/query/hash are ignored (`URL.origin`).
 */
export function resolvePublicSiteOrigin(
	env: SiteOriginEnv = process.env,
): SiteOriginResult {
	const siteRaw = env.SITE_URL?.trim();
	if (siteRaw) {
		const origin = parseOrigin(siteRaw);
		if (!origin) return { ok: false, error: "site_origin_invalid" };
		return { ok: true, origin, source: "SITE_URL" };
	}

	const authRaw = env.AUTH_URL?.trim();
	if (authRaw) {
		const origin = parseOrigin(authRaw);
		if (!origin) return { ok: false, error: "site_origin_invalid" };
		return { ok: true, origin, source: "AUTH_URL" };
	}

	return { ok: false, error: "site_origin_missing" };
}

/** Absolute URL for a site-relative path (must start with `/`). */
export function buildPublicSiteUrl(origin: string, pathWithQuery: string): string {
	const base = origin.replace(/\/+$/, "");
	const path = pathWithQuery.startsWith("/")
		? pathWithQuery
		: `/${pathWithQuery}`;
	return `${base}${path}`;
}
