export type Portal = "masseur" | "client" | "admin";
export type PublicPortal = "masseur" | "client";

export const PORTALS = ["masseur", "client", "admin"] as const;
export const PUBLIC_PORTALS = ["masseur", "client"] as const;

export const AUTH_PORTAL_COOKIE = "serein-auth-portal";
export const AUTH_INTENT_COOKIE = "serein-auth-intent";

/**
 * Request header so shared APIs can pick the right portal session when both
 * client and masseur cookies are present in the same browser.
 */
export const PORTAL_REQUEST_HEADER = "x-portal";

export function portalRequestHeaders(portal: PublicPortal): Record<string, string> {
  return { [PORTAL_REQUEST_HEADER]: portal };
}

export type AuthIntent = "login" | "register";

export function isPortal(value: unknown): value is Portal {
  return value === "masseur" || value === "client" || value === "admin";
}

export function isPublicPortal(value: unknown): value is PublicPortal {
  return value === "masseur" || value === "client";
}

export function isAuthIntent(value: unknown): value is AuthIntent {
  return value === "login" || value === "register";
}

export function portalAuthBasePath(portal: Portal) {
  return `/api/auth/${portal}`;
}

/** Login / auth entry for a portal. */
export function portalHomePath(portal: Portal) {
  if (portal === "masseur") return "/masseur/login";
  if (portal === "client") return "/client/login";
  return "/admin/login";
}

export function isPortalLoginPath(path: string, portal: Portal) {
  const login = portalHomePath(portal);
  return path === login || path.startsWith(`${login}/`);
}

export function portalDefaultCallback(portal: Portal) {
  if (portal === "masseur") return "/masseur/dashboard";
  if (portal === "client") return "/client";
  return "/admin";
}
