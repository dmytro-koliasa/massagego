"use client";

import { useEffect } from "react";
import { signOut, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { BackNavLink } from "@/components/back-nav-link";
import { useLanguage } from "@/components/language-provider";
import { MasseurAuthPanel } from "@/components/masseur-auth-panel";

export default function MasseurEntryPage() {
  const { t } = useLanguage();
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

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
          router.replace("/masseur/dashboard");
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
  }, [status, session?.user?.id, session?.user?.portal, router]);

  const waitingForRedirect =
    status === "authenticated" &&
    Boolean(session?.user?.id) &&
    session?.user?.portal === "masseur";

  return (
    <main className="relative flex flex-1 flex-col bg-background py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-8 px-[15px] text-center">
        <div className="max-w-xl space-y-3">
          <h1 className="font-display text-4xl tracking-[-0.04em] text-foreground sm:text-5xl">
            {t.masseurPageTitle}
          </h1>
          <p className="text-muted">{t.masseurPageSupport}</p>
        </div>

        {waitingForRedirect ? (
          <p className="text-sm text-muted">{t.authPleaseWait}</p>
        ) : (
          <MasseurAuthPanel
            portal="masseur"
            callbackUrl="/masseur/dashboard"
          />
        )}

        <BackNavLink href="/">{t.backHome}</BackNavLink>
      </div>
    </main>
  );
}
