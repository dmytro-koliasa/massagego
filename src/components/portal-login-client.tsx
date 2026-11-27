"use client";

import { Suspense, useEffect } from "react";
import { signOut, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { BackNavLink } from "@/components/back-nav-link";
import { useLanguage } from "@/components/language-provider";
import { MasseurAuthPanel } from "@/components/masseur-auth-panel";
import { Preloader } from "@/components/preloader";
import type { PublicPortal } from "@/lib/portals";
import { resolveSafePortalCallback } from "@/lib/safe-internal-path";

type Props = {
  portal: PublicPortal;
};

function PortalLoginIsland({ portal }: Props) {
  const { t } = useLanguage();
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = resolveSafePortalCallback(
    portal,
    searchParams.get("next"),
  );

  const title = portal === "client" ? t.clientPageTitle : t.masseurPageTitle;
  const support =
    portal === "client" ? t.clientAuthSupport : t.masseurPageSupport;

  useEffect(() => {
    const error = searchParams.get("error");
    if (error === "blocked") {
      toast.error(t.authAccountBlocked);
    } else if (
      portal === "masseur" &&
      (error === "oauth_not_linked" ||
        error === "OAuthAccountNotLinked" ||
        error === "AccountNotLinked")
    ) {
      toast.error(t.authOAuthNotLinked);
    } else if (error === "no_portal_access" || error === "AccessDenied") {
      toast.error(t.authNoPortalAccess);
    }
  }, [
    portal,
    searchParams,
    t.authAccountBlocked,
    t.authNoPortalAccess,
    t.authOAuthNotLinked,
  ]);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) {
      return;
    }

    if (session.user.portal !== portal) {
      return;
    }

    let cancelled = false;
    const profilePath =
      portal === "client" ? "/api/client/profile" : "/api/masseur/profile";

    async function goToAppOrReset() {
      try {
        const response = await fetch(profilePath, {
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

    void goToAppOrReset();

    return () => {
      cancelled = true;
    };
  }, [
    status,
    session?.user?.id,
    session?.user?.portal,
    router,
    callbackUrl,
    portal,
  ]);

  const waitingForRedirect =
    status === "authenticated" &&
    Boolean(session?.user?.id) &&
    session?.user?.portal === portal;

  if (waitingForRedirect && portal === "masseur") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <Preloader label={t.authPleaseWait} />
      </div>
    );
  }

  return (
    <>
      <div className="max-w-xl space-y-3">
        <h1 className="font-display text-4xl tracking-[-0.04em] text-foreground sm:text-5xl">
          {title}
        </h1>
        <p className="text-muted">{support}</p>
      </div>

      {waitingForRedirect ? (
        <p className="text-sm text-muted">{t.authPleaseWait}</p>
      ) : (
        <MasseurAuthPanel portal={portal} callbackUrl={callbackUrl} />
      )}

      <BackNavLink href="/">{t.backHome}</BackNavLink>
    </>
  );
}

export function PortalLoginClient({ portal }: Props) {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted">Loading…</p>}
    >
      <PortalLoginIsland portal={portal} />
    </Suspense>
  );
}
