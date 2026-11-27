"use client";

import { Suspense, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { BackNavLink } from "@/components/back-nav-link";
import { AdminAuthPanel } from "@/components/admin-auth-panel";
import { useLanguage } from "@/components/language-provider";
import { Preloader } from "@/components/preloader";
import { resolveSafePortalCallback } from "@/lib/safe-internal-path";

function AdminLoginContent() {
  const { t } = useLanguage();
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = resolveSafePortalCallback(
    "admin",
    searchParams.get("next"),
  );

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
    <main className="relative flex flex-1 flex-col bg-background py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-start gap-8 px-[15px] text-center">
        <div className="max-w-xl space-y-3">
          <h1 className="font-display text-4xl tracking-[-0.04em] text-foreground sm:text-5xl">
            {t.adminLoginTitle}
          </h1>
          <p className="text-muted">{t.adminDescription}</p>
        </div>

        <AdminAuthPanel />

        <BackNavLink href="/">{t.backHome}</BackNavLink>
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
