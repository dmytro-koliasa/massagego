import type { MetadataRoute } from "next";
import {
	buildPublicSiteUrl,
	resolvePublicSiteOrigin,
} from "@/lib/seo/site-origin";

/** Request-time origin (SITE_URL / AUTH_URL) — avoid build-time host freeze. */
export const dynamic = "force-dynamic";

/**
 * Crawl policy (#203):
 * - Allow public pages and login URLs (so crawlers can fetch noindex).
 * - Do not Disallow login paths.
 * - Disallow API only (robots ≠ authorization).
 * - Static assets under /_next/ remain allowed by default.
 */
export default function robots(): MetadataRoute.Robots {
	const origin = resolvePublicSiteOrigin();
	return {
		rules: {
			userAgent: "*",
			allow: "/",
			disallow: ["/api/"],
		},
		...(origin.ok
			? { sitemap: buildPublicSiteUrl(origin.origin, "/sitemap.xml") }
			: {}),
	};
}
