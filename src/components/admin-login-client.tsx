"use client";

import { Suspense, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { BackNavLink } from "@/components/back-nav-link";
import { AdminAuthPanel } from "@/components/admin-auth-panel";
import { useLanguage } from "@/components/language-provider";
import { Preloader } from "@/components/preloader";
import { portalDefaultCallback } from "@/lib/portals";

function AdminLoginContent() {
  const { t } = useLanguage();
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");
  const callbackUrl =
    nextPath &&
    nextPath.startsWith("/admin") &&
    !nextPath.startsWith("/admin/login")
      ? nextPath
      : portalDefaultCallback("admin");

  useEffect(() => {
    const error = searchParams.get("error");
    if (error === "blocked") {
      toast.error(t.authAccountBlocked);
    }
  }, [searchParams, t.authAccountBlocked]);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.portal === "admin") {
      router.replace(callbackUrl);
    }
  }, [status, session?.user?.portal, router, callbackUrl]);

  if (status === "authenticated" && session?.user?.portal === "admin") {
    return (
      <main className="relative flex flex-1 flex-col items-center justify-center bg-background">
        <Preloader label={t.authPleaseWait} />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col bg-background py-10">
      <div className="mx-auto w-full max-w-lg flex-1 px-[15px]">
        <BackNavLink href="/">{t.backHome}</BackNavLink>
        <div className="mt-8 space-y-3 text-center">
          <h1 className="font-display text-4xl tracking-[-0.03em] text-foreground">
            {t.adminLoginTitle}
          </h1>
          <p className="text-sm text-muted">{t.adminDescription}</p>
        </div>
        <div className="mt-8">
          <AdminAuthPanel />
        </div>
      </div>
    </main>
  );
}

export function AdminLoginClient() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center justify-center bg-background">
          <Preloader />
        </main>
      }
    >
      <AdminLoginContent />
    </Suspense>
  );
}
