import { AppToaster } from "@/components/app-toaster";
import { NavigationPreloader } from "@/components/navigation-preloader";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeaderMarketing } from "@/components/site-header-marketing";

/**
 * Public marketing/legal shell (#206): no AuthSessionProvider / next-auth client.
 */
export default function MarketingLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<>
			<NavigationPreloader />
			<SiteHeaderMarketing />
			{children}
			<SiteFooter />
			<AppToaster />
		</>
	);
}
