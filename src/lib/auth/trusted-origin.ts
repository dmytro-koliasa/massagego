/**
 * Trusted public origin for auth links and verify redirects (#124).
 *
 * Never derive these URLs from `request.url` / Host — that lets a forged host
 * poison password-reset and email-verification links.
 */

/** Subset of process.env used for trusted-origin decisions (tests pass plain objects). */
export type TrustedOriginEnv = {
  readonly [key: string]: string | undefined;
};

export type TrustedOriginResult =
  | { ok: true; origin: string }
  | { ok: false; error: "auth_url_missing" | "auth_url_invalid" };

/**
 * Resolve the canonical app origin from `AUTH_URL` only.
 * Trailing slashes are stripped. Path/query/hash on AUTH_URL are ignored
 * (`URL.origin`). No fallback to request hosts or localhost.
 */
export function resolveTrustedAppOrigin(
  env: TrustedOriginEnv = process.env,
): TrustedOriginResult {
  const raw = env.AUTH_URL?.trim();
  if (!raw) {
    return { ok: false, error: "auth_url_missing" };
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, error: "auth_url_invalid" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "auth_url_invalid" };
  }

  return { ok: true, origin: parsed.origin };
}

/** Join a site-relative path (must start with `/`) to a trusted origin. */
export function buildTrustedAppUrl(origin: string, pathWithQuery: string): string {
  const base = origin.replace(/\/+$/, "");
  const path = pathWithQuery.startsWith("/")
    ? pathWithQuery
    : `/${pathWithQuery}`;
  return `${base}${path}`;
}
