import type { Metadata } from "next";
import { portalRobots } from "@/lib/seo/public-metadata";

export const metadata: Metadata = {
	title: "Admin — MassageGo",
	robots: portalRobots,
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
	return children;
}
