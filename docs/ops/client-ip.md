# Client IP trust model (#115)

Used by IP-based rate limits (`getClientIp` in `src/lib/request-ip.ts`).

## Rules

1. Prefer `x-vercel-forwarded-for` when present (Vercel).
2. Else if `TRUST_PROXY_HOPS` is a positive integer **N**, take the **Nth hop from the right** of `x-forwarded-for` (append-style proxies; `1` = rightmost).
3. Else on Vercel (`VERCEL=1` / `VERCEL_ENV`): treat as one trusted hop → rightmost XFF, else `x-real-ip`.
4. Else (typical local `next dev`): **ignore** client-supplied forwarded headers → `"unknown"`.

Do not trust the leftmost XFF hop by default — it is client-spoofable when proxies append.

## Local

Leave `TRUST_PROXY_HOPS` empty. Spoofed `x-forwarded-for` must not change rate-limit identity.

## Non-Vercel reverse proxy (later)

Set `TRUST_PROXY_HOPS=1` (or the number of append-style proxies in front of the app). Do not enable paid WAF products for this.

## Production deploy

Still deferred. When a host is chosen, confirm whether it sets `x-vercel-forwarded-for` or requires `TRUST_PROXY_HOPS`.
