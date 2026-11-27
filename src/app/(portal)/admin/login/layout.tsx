import type { Metadata } from "next";
import { portalRobots } from "@/lib/seo/public-metadata";

export const metadata: Metadata = {
	title: "Admin sign in — MassageGo",
	description: "Sign in to the MassageGo admin portal.",
	robots: portalRobots,
};

export default function AdminLoginLayout({
	children,
}: LayoutProps<"/admin/login">) {
	return children;
}
