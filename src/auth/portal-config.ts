import type { NextAuthConfig } from "next-auth";
import type { Portal } from "@/lib/portals";
import { portalAuthBasePath, portalHomePath } from "@/lib/portals";

const useSecureCookies = process.env.NODE_ENV === "production";

function cookieName(portal: Portal, name: string) {
  const prefix = useSecureCookies ? "__Secure-" : "";
  return `${prefix}authjs.${portal}.${name}`;
}

function cookieOptions(httpOnly = true) {
  return {
    httpOnly,
    sameSite: "lax" as const,
    path: "/",
    secure: useSecureCookies,
  };
}

export function createPortalCookies(portal: Portal) {
  return {
    sessionToken: {
      name: cookieName(portal, "session-token"),
      options: cookieOptions(true),
    },
    callbackUrl: {
      name: cookieName(portal, "callback-url"),
      options: cookieOptions(false),
    },
    csrfToken: {
      name: cookieName(portal, "csrf-token"),
      options: cookieOptions(true),
    },
    pkceCodeVerifier: {
      name: cookieName(portal, "pkce-code-verifier"),
      options: {
        ...cookieOptions(true),
        maxAge: 60 * 15,
      },
    },
    state: {
      name: cookieName(portal, "state"),
      options: {
        ...cookieOptions(true),
        maxAge: 60 * 15,
      },
    },
    nonce: {
      name: cookieName(portal, "nonce"),
      options: cookieOptions(true),
    },
  };
}

export function createPortalAuthConfig(portal: Portal): NextAuthConfig {
  return {
    basePath: portalAuthBasePath(portal),
    pages: {
      signIn: portalHomePath(portal),
      error: portalHomePath(portal),
    },
    cookies: createPortalCookies(portal),
    providers: [],
    trustHost: true,
    session: { strategy: "jwt" },
    callbacks: {
      authorized({ auth, request }) {
        const isLoggedIn = Boolean(auth?.user);
        const path = request.nextUrl.pathname;

        if (portal === "masseur" && path.startsWith("/masseur/dashboard")) {
          return isLoggedIn;
        }

        if (portal === "client" && path.startsWith("/client/")) {
          if (isLoggedIn) return true;
          const loginUrl = new URL("/client", request.nextUrl);
          loginUrl.searchParams.set("next", path);
          return Response.redirect(loginUrl);
        }

        return true;
      },
    },
  };
}
