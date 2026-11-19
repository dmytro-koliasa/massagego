/**
 * Client IP for rate limiting (#115 / H5).
 *
 * Trust model (do not blindly use first or last XFF without context):
 *
 * 1. `x-vercel-forwarded-for` — prefer when present (Vercel platform header).
 * 2. `TRUST_PROXY_HOPS` — positive integer N: take the Nth hop from the right
 *    of `x-forwarded-for` (append-style proxies; N=1 → rightmost = TCP peer
 *    observed by the nearest trusted proxy).
 * 3. Vercel runtime (`VERCEL=1` / `VERCEL_ENV`) without (1)/(2): treat as one
 *    trusted hop → rightmost XFF, else `x-real-ip`.
 * 4. Otherwise (local `next dev`, no trusted proxy configured): ignore
 *    client-supplied `x-forwarded-for` / `x-real-ip` and return `"unknown"`.
 *
 * Callers already hash subjects via `rateLimitKey`; `"unknown"` collapses
 * unproxied local traffic into one bucket (acceptable for local-only abuse
 * resistance).
 */

const IP_MAX_LEN = 128;

function clampIp(value: string): string {
  return value.slice(0, IP_MAX_LEN);
}

function firstHeaderValue(raw: string | null): string | null {
  if (!raw) return null;
  const first = raw.split(",")[0]?.trim();
  return first || null;
}

/** Nth hop from the right (N=1 → last hop). */
export function pickTrustedXffHop(
  forwarded: string | null,
  trustedHops: number,
): string | null {
  if (!forwarded || !Number.isInteger(trustedHops) || trustedHops < 1) {
    return null;
  }
  const parts = forwarded
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < trustedHops) return null;
  return parts[parts.length - trustedHops] ?? null;
}

export function parseTrustProxyHops(
  raw: string | undefined | null,
): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

/** Subset of process.env used for IP trust decisions (tests pass plain objects). */
export type ClientIpEnv = {
  readonly [key: string]: string | undefined;
};

export function isVercelRuntime(env: ClientIpEnv = process.env): boolean {
  if (env.VERCEL === "1") return true;
  const vercelEnv = env.VERCEL_ENV?.trim();
  return (
    vercelEnv === "production" ||
    vercelEnv === "preview" ||
    vercelEnv === "development"
  );
}

export function getClientIp(
  request: Request,
  env: ClientIpEnv = process.env,
): string {
  const vercelForwarded = firstHeaderValue(
    request.headers.get("x-vercel-forwarded-for"),
  );
  if (vercelForwarded) return clampIp(vercelForwarded);

  const configuredHops = parseTrustProxyHops(env.TRUST_PROXY_HOPS);
  if (configuredHops !== null) {
    const hop = pickTrustedXffHop(
      request.headers.get("x-forwarded-for"),
      configuredHops,
    );
    if (hop) return clampIp(hop);
  }

  if (isVercelRuntime(env)) {
    const hop = pickTrustedXffHop(request.headers.get("x-forwarded-for"), 1);
    if (hop) return clampIp(hop);
    const realIp = request.headers.get("x-real-ip")?.trim();
    if (realIp) return clampIp(realIp);
  }

  return "unknown";
}
