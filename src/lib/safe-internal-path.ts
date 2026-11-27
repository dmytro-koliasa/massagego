import {
  portalDefaultCallback,
  portalHomePath,
  type Portal,
} from "@/lib/portals";

function decodePathRepeatedly(value: string): string | null {
  let current = value;
  for (let i = 0; i < 5; i += 1) {
    try {
      const next = decodeURIComponent(current);
      if (next === current) return current;
      current = next;
    } catch {
      return null;
    }
  }
  return current;
}

/**
 * Validate a post-login `next` destination for a portal (#207 AD-3/AD-4).
 * Allows same-portal path + query; rejects absolute/external/protocol-relative.
 */
export function resolveSafePortalCallback(
  portal: Portal,
  raw: string | null | undefined,
): string {
  const fallback = portalDefaultCallback(portal);
  if (raw == null) return fallback;

  const trimmed = raw.trim();
  if (!trimmed) return fallback;

  // Reject absolute / protocol-relative / backslash / encoded tricks.
  if (
    /^[a-zA-Z][a-zA-Z+\-.]*:/.test(trimmed) ||
    trimmed.startsWith("//") ||
    trimmed.includes("\\") ||
    trimmed.includes("@")
  ) {
    return fallback;
  }

  let pathname: string;
  let search = "";
  try {
    // Resolve against a dummy origin so `?a=1` alone is rejected (no path).
    const url = new URL(trimmed, "http://massagego.local");
    if (url.origin !== "http://massagego.local") return fallback;
    pathname = url.pathname;
    search = url.search;
  } catch {
    return fallback;
  }

  if (!pathname.startsWith("/")) return fallback;

  // Decode encoded traversal (`%2e%2e`, double-encoding) then re-normalize.
  const decodedPath = decodePathRepeatedly(pathname);
  if (decodedPath == null) return fallback;
  try {
    const normalized = new URL(decodedPath, "http://massagego.local");
    if (normalized.origin !== "http://massagego.local") return fallback;
    pathname = normalized.pathname;
  } catch {
    return fallback;
  }

  if (
    pathname.includes("\\") ||
    pathname.includes("//") ||
    pathname.includes("%")
  ) {
    return fallback;
  }

  const login = portalHomePath(portal);
  if (pathname === login || pathname.startsWith(`${login}/`)) {
    return fallback;
  }

  if (portal === "client") {
    if (pathname !== "/client" && !pathname.startsWith("/client/")) {
      return fallback;
    }
  } else if (portal === "masseur") {
    if (pathname !== "/masseur" && !pathname.startsWith("/masseur/")) {
      return fallback;
    }
  } else if (portal === "admin") {
    if (pathname !== "/admin" && !pathname.startsWith("/admin/")) {
      return fallback;
    }
  }

  return `${pathname}${search}`;
}

/** Path+search for proxy `next` (preserves catalog deep-link query). */
export function portalContinuePath(pathname: string, search: string): string {
  const q = search.startsWith("?")
    ? search
    : search
      ? `?${search}`
      : "";
  return `${pathname}${q}`;
}
