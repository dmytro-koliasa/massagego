import type { Metadata } from "next";
import { cookies } from "next/headers";
import { HomeHero } from "@/components/home-hero";
import {
  publicPageMetadata,
  readLocaleCookie,
} from "@/lib/seo/public-metadata";

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = readLocaleCookie(cookieStore.get("serein-locale")?.value);
  return publicPageMetadata("/", locale);
}

export default function Home() {
  return (
    <main className="relative -mt-[4.25rem] h-dvh overflow-hidden bg-[var(--landing-bg)]">
      <HomeHero />
    </main>
  );
}
