import type { Metadata } from "next";
import { portalRobots } from "@/lib/seo/public-metadata";

export const metadata: Metadata = {
	title: "Masseur — MassageGo",
	robots: portalRobots,
};

export default function MasseurLayout({ children }: LayoutProps<"/masseur">) {
	return children;
}
