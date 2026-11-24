# Lessons

## 2026-11-24 — 001-p1-blocked-access-hardening

Measured (manual / no supervisor `--lessons` on Windows — `fcntl` missing):

| card / batch | kind | size | effort | notes |
| --- | --- | --- | --- | --- |
| T001 | fullstack | M | high | baseline only; no app commit |
| B1 (T002–T004) | backend | M×3 | high | one commit; integration needed TEST_DATABASE_URL |
| B2 (T005–T006) | backend | M+S | high | shared `enforceIpAccountRateLimit` paid off |
| CPA | fullstack | S | high | green; supervisor skipped on Win |
| T007 / CPEND | fullstack | M+S | medium/low | close |

What to do differently next feature:

1. Set `TEST_DATABASE_URL` in the first card session — T001 noted it unset and B1 almost stumbled.
2. Prefer one commit per batch on Windows when cards share a working tree (B1/B2) — splitting mid-batch commits is awkward after parallel edits.
3. `npm run lint` at repo root still fails on `.cursor/skills`; always scope `eslint src tests` (or fix eslintignore) so CPA Verify matches CI.
4. supervisor/autopilot needs WSL or a non-fcntl lock — don't plan Windows-native autopilot until fixed.
5. Defense-in-depth gates (`blockedAt` in portal-gate) still matter even when JWT callback already clears blocked users — tests caught the 403/401 distinction.

## 2026-11-24 — 002-p2-tests-and-deps

Measured (manual / no supervisor `--lessons` on Windows — `fcntl` missing):

| card / batch | kind | size | effort | notes |
| --- | --- | --- | --- | --- |
| T001 | fullstack | M | medium | RESUME + code map; TEST_DATABASE_URL required |
| B1 (T002–T003) | fullstack | M×2 | high | gallery + availability; FullCalendar drag-select |
| B2 (T004–T005) | fullstack | M×2 | high | register needs city hydration wait; delete via Prisma seed |
| B3 (T006–T007) | fullstack | M+S | high | e2e-smoke YAML + docs |
| T008 | fullstack | M | medium | safe audit fix; Prisma 7 → #193 |
| CPA / T009 / CPEND | fullstack | S | high | IP rate-limit clears for 8-file smoke; eslint hydration via useSyncExternalStore |

What to do differently next feature:

1. Playwright vs next-dev: wait for client hydration (`useSyncExternalStore` / `data-hydrated`) before filling forms — SSR markup is clickable without handlers.
2. Long smoke lists on one IP trip `signin:ip` (10/15m) — clear shared IP rate-limit buckets in fixtures, do not raise production limits.
3. Keep CI smoke as an **explicit file list**; never `e2e/` wholesale on every PR.
4. `npm audit fix --omit=dev` can prune `node_modules` — restore with `npm ci`; never `audit fix --force` for Prisma/Blob majors.
5. City search E2E: stub `/api/geocode/city`; fill() + Search after hydration, not raw DOM `value=` before React attaches.

## 2026-11-24 — 003-p3-module-splits

Measured (manual / no supervisor on Windows):

| card / batch | kind | size | effort | notes |
| --- | --- | --- | --- | --- |
| B1 | backend | M | medium | portal-session + unify `{ok}` shapes |
| B2–B4 | frontend | M×3 | high | calendar main stays large; dialog/sections seams |
| B5 | fullstack | M | medium | locale modules; barrel `@/lib/i18n` |
| CPA | fullstack | S | medium | integration 429 after smoke = polluted rateLimitBucket |

What to do differently next feature:

1. After local smoke/integration, clear TEST DB `rateLimitBucket` before CPA re-verify — shared IP keys look like product regressions.
2. Prefer folder + barrel over thinning a FullCalendar shell past the orchestration seam.
3. Gate moves: delete notification-local portal-gate entirely; one server module path.
