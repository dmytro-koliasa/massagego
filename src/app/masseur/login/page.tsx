"use client";

import { Suspense, useEffect } from "react";
import { signOut, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { BackNavLink } from "@/components/back-nav-link";
import { useLanguage } from "@/components/language-provider";
import { MasseurAuthPanel } from "@/components/masseur-auth-panel";
import { Preloader } from "@/components/preloader";
import { portalDefaultCallback } from "@/lib/portals";

function MasseurLoginContent() {
  const { t } = useLanguage();
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");
  const callbackUrl =
    nextPath &&
    nextPath.startsWith("/masseur") &&
    !nextPath.startsWith("/masseur/login")
      ? nextPath
      : portalDefaultCallback("masseur");

  useEffect(() => {
    const error = searchParams.get("error");
    if (error === "no_portal_access" || error === "AccessDenied") {
      toast.error(t.authNoPortalAccess);
    }
  }, [searchParams, t.authNoPortalAccess]);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) {
      return;
    }

    if (session.user.portal !== "masseur") {
      return;
    }

    let cancelled = false;

    async function goToDashboardOrReset() {
      try {
        const response = await fetch("/api/masseur/profile", {
          method: "GET",
          cache: "no-store",
        });

        if (cancelled) return;

        if (response.ok) {
          router.replace(callbackUrl);
          return;
        }

        await signOut({ redirect: false });
      } catch {
        if (!cancelled) {
          await signOut({ redirect: false });
        }
      }
    }

    void goToDashboardOrReset();

    return () => {
      cancelled = true;
    };
  }, [status, session?.user?.id, session?.user?.portal, router, callbackUrl]);

  const waitingForRedirect =
    status === "authenticated" &&
    Boolean(session?.user?.id) &&
    session?.user?.portal === "masseur";

  if (waitingForRedirect) {
    return (
      <main className="relative flex flex-1 flex-col items-center justify-center bg-background">
        <Preloader label={t.authPleaseWait} />
      </main>
    );
  }

  return (
    <main className="relative flex flex-1 flex-col bg-background py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-8 px-[15px] text-center">
        <div className="max-w-xl space-y-3">
          <h1 className="font-display text-4xl tracking-[-0.04em] text-foreground sm:text-5xl">
            {t.masseurPageTitle}
          </h1>
          <p className="text-muted">{t.masseurPageSupport}</p>
        </div>

        <MasseurAuthPanel portal="masseur" callbackUrl={callbackUrl} />

        <BackNavLink href="/">{t.backHome}</BackNavLink>
      </div>
    </main>
  );
}

export default function MasseurLoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center justify-center bg-background px-[15px] py-10">
          <p className="text-sm text-muted">Loading…</p>
        </main>
      }
    >
      <MasseurLoginContent />
    </Suspense>
  );
}
