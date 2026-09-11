"use client";

import { usePathname } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { portalAuthBasePath, type Portal } from "@/lib/portals";

function resolvePortal(pathname: string | null): Portal {
  if (pathname?.startsWith("/client")) return "client";
  return "masseur";
}

export function AuthSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const portal = resolvePortal(pathname);

  return (
    <SessionProvider
      key={portal}
      basePath={portalAuthBasePath(portal)}
      refetchOnWindowFocus
    >
      {children}
    </SessionProvider>
  );
}
