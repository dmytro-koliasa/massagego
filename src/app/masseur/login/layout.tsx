import type { Metadata } from "next";
import { portalRobots } from "@/lib/seo/public-metadata";

export const metadata: Metadata = {
	title: "Masseur sign in — MassageGo",
	description: "Sign in to the MassageGo masseur portal.",
	robots: portalRobots,
};

export default function MasseurLoginLayout({
	children,
}: LayoutProps<"/masseur/login">) {
	return children;
}
