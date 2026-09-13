export type Portal = "masseur" | "client";

export const PORTALS = ["masseur", "client"] as const;

export const AUTH_PORTAL_COOKIE = "serein-auth-portal";
export const AUTH_INTENT_COOKIE = "serein-auth-intent";

export type AuthIntent = "login" | "register";

export function isPortal(value: unknown): value is Portal {
  return value === "masseur" || value === "client";
}

export function isAuthIntent(value: unknown): value is AuthIntent {
  return value === "login" || value === "register";
}

export function portalAuthBasePath(portal: Portal) {
  return `/api/auth/${portal}`;
}

export function portalHomePath(portal: Portal) {
  return portal === "masseur" ? "/masseur" : "/client/login";
}

export function portalDefaultCallback(portal: Portal) {
  return portal === "masseur" ? "/masseur/dashboard" : "/client";
}
