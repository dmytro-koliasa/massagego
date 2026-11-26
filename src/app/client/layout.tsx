import type { Metadata } from "next";
import { portalRobots } from "@/lib/seo/public-metadata";

export const metadata: Metadata = {
	title: "Client — MassageGo",
	robots: portalRobots,
};

export default function ClientLayout({ children }: LayoutProps<"/client">) {
	return children;
}
