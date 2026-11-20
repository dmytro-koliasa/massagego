# Client IP trust model (#115 / #126)

Used by IP-based rate limits (`getClientIp` in `src/lib/request-ip.ts`).

## Rules

1. **Only on Vercel runtime** (`VERCEL=1` / `VERCEL_ENV`): prefer `x-vercel-forwarded-for` (rightmost hop if the value is a comma-separated chain). Off Vercel that header is ignored like any other client-supplied forwarded header (#126).
2. Else if `TRUST_PROXY_HOPS` is a positive integer **N**, take the **Nth hop from the right** of `x-forwarded-for` (append-style proxies; `1` = rightmost).
3. Else on Vercel: treat as one trusted hop → rightmost XFF, else `x-real-ip`.
4. Else (typical local `next dev`): **ignore** client-supplied forwarded headers → `"unknown"`.

Do not trust the leftmost XFF hop by default — it is client-spoofable when proxies append. Do not trust `x-vercel-forwarded-for` unless this process is actually on Vercel.

## Local

Leave `TRUST_PROXY_HOPS` empty. Spoofed `x-forwarded-for` / `x-vercel-forwarded-for` must not change rate-limit identity.

## Non-Vercel reverse proxy (later)

Set `TRUST_PROXY_HOPS=1` (or the number of append-style proxies in front of the app). Do not enable paid WAF products for this.

## Production deploy

Still deferred. When a host is chosen, confirm whether it sets `x-vercel-forwarded-for` (Vercel) or requires `TRUST_PROXY_HOPS`.
