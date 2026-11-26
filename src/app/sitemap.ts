import type { MetadataRoute } from "next";
import {
	buildPublicSiteUrl,
	resolvePublicSiteOrigin,
} from "@/lib/seo/site-origin";

/** Request-time origin (SITE_URL / AUTH_URL) — avoid build-time host freeze. */
export const dynamic = "force-dynamic";

/** Indexable public marketing/legal URLs only (#203). Portals and logins excluded. */
export default function sitemap(): MetadataRoute.Sitemap {
	const origin = resolvePublicSiteOrigin();
	if (!origin.ok) {
		return [];
	}

	const lastModified = new Date();
	return (
		[
			{ path: "/", priority: 1, changeFrequency: "weekly" as const },
			{ path: "/privacy", priority: 0.5, changeFrequency: "monthly" as const },
			{ path: "/terms", priority: 0.5, changeFrequency: "monthly" as const },
		] as const
	).map(({ path, priority, changeFrequency }) => ({
		url: buildPublicSiteUrl(origin.origin, path),
		lastModified,
		changeFrequency,
		priority,
	}));
}
