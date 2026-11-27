# #208 — Accessibility and Runtime Quality Verification

**Branch:** `feat/208-a11y-runtime-quality`  
**Baseline master:** `9164f09` (post #207 / PR #218)  
**Status:** Implementation started after owner “продолжай” — recommended AD-1…AD-6 treated as approved.

## Approved decisions

| ID | Decision |
| --- | --- |
| AD-1 | **A+** — `devDependency` `@axe-core/playwright`; never ship axe in the client bundle |
| AD-2 | Representative route matrix (below); EN+UK × light/dark × desktop+mobile on a narrow key set |
| AD-3 | **A+** — harness isolation (`clearAuthRateLimits`, durable asserts, soft-nav waits); keep CI `retries: 1`; no `workers: 1` unless A+ proves insufficient |
| AD-4 | Primary evidence = production `next build` + `next start`; preserve `AUTH_URL` = Playwright `baseURL` (`127.0.0.1`) |
| AD-5 | Confirmed defect = serious/critical automated WCAG hits, keyboard/focus/dialog/name/contrast failures on primary UI, hydration/console errors — not redesign-by-linter |
| AD-6 | Sanitized reports under `docs/quality/` (no PII/credentials); limitations documented honestly |

### Clarifications accepted with AD defaults

- Mobile: Chromium Playwright device emulation + DevTools spot-check; not a separate browser matrix.
- Screen reader: semantic/name/keyboard evidence required; full NVDA/VoiceOver pass is optional stretch (document if not run).
- Architecture note committed on this branch before/with tooling.

## Representative routes

| Surface | Routes |
| --- | --- |
| Public | `/`, `/privacy`, `/terms`, `/client/login`, `/masseur/login`, `/admin/login` |
| Client | `/client`, `/client/notifications`, booking/masseur deep-link as existing fixtures allow |
| Masseur | `/masseur/dashboard`, `/masseur/notifications` |
| Admin | `/admin`, `/admin/complaints`, user detail + ConfirmDialog |

## Out of scope

Product redesign; new features; paid a11y SaaS; Vercel Preview remediation; claiming full WCAG conformance from automation alone; treating brand `<p>` (R21-A11Y-01) as defective without heading evidence.

## Carry-in from prior issues

- **#204–#207 / #216:** preserve architecture and calendar/portal test improvements.
- **#207 leftovers:** parallel CI rate-limit / soft-nav / toast races → continue harness hardening here.
- **#140:** modal focus trap — regression-check only.

## Methodology

1. Distinguish **application** vs **harness/environment** defects.
2. Do not skip tests, weaken assertions, raise retries, or disable production security controls.
3. Automated axe ≠ full WCAG compliance.
4. Fix only confirmed in-scope defects with minimal UI change.

## Progress log

| Step | Result |
| --- | --- |
| Branch + In Progress comment | Done |
| AD doc | This file |
| `@axe-core/playwright` | **Added** as `devDependency` `^4.13.0` + `e2e/helpers/axe.ts` + `e2e/a11y-axe-208.spec.ts` |
| Baseline scans (prod) | Public `/`, `/privacy`, `/terms` — **PASS** after contrast fix; client/masseur login — **PASS**; admin login + authenticated portals — **BLOCKED** locally (Docker Desktop / Postgres `ECONNREFUSED`) |
| Confirmed fix | Light-theme `--accent` / `--muted` / accent-soft + inactive lang/tab labels for WCAG AA color-contrast |
| Environment notes | Local Node `v20.18.0` < Prisma engine gate `20.19+`; `prisma generate` also hits `@prisma/dev`/`zeptomatch` ESM `ERR_REQUIRE_ESM`. Workaround used: `npm ci --ignore-scripts` + existing generated client + `next build --webpack`. Prefer upgrading Node ≥20.19 when possible. |

## Findings (sanitized)

| ID | Severity | Surfaces | Status |
| --- | --- | --- | --- |
| color-contrast | serious | Light accent links + muted controls on `accent-soft` | **Fixed** (token + label color) |
| Auth portal axe | — | admin login / client / masseur authenticated | **BLOCKED** until Postgres available |
