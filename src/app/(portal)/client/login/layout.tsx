import type { Metadata } from "next";
import { portalRobots } from "@/lib/seo/public-metadata";

export const metadata: Metadata = {
	title: "Client sign in — MassageGo",
	description: "Sign in to the MassageGo client portal.",
	robots: portalRobots,
};

export default function ClientLoginLayout({
	children,
}: LayoutProps<"/client/login">) {
	return children;
}
