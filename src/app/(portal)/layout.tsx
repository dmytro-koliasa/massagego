import { AppToaster } from "@/components/app-toaster";
import { AuthSessionProvider } from "@/components/auth-session-provider";
import { NavigationPreloader } from "@/components/navigation-preloader";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

/**
 * Authenticated portal shell (#206): SessionProvider only here, not on marketing.
 */
export default function PortalLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<AuthSessionProvider>
			<NavigationPreloader />
			<SiteHeader />
			{children}
			<SiteFooter />
			<AppToaster />
		</AuthSessionProvider>
	);
}
