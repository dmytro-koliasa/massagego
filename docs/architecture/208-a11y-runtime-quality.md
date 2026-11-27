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
| Baseline scans (prod) | Public + login + authenticated client/masseur/admin + dark/mobile — **PASS** (serious/critical) |
| Confirmed fixes | (1) Light contrast tokens + inactive labels (2) Inline privacy/terms underline (3) Dark `--accent-foreground` on filled accent controls (4) Availability `text-red-700 dark:text-red-400` (5) Brand touch target + signed-in header de-clutter |
| Harness | Axe waits for `.animate-fade-up` opacity; authenticated axe describe is **serial** (local Postgres accept-queue under 6 workers); `skipDuplicates` on fixture `createMany`; E2E Prisma connect timeout 30s |
| E2E stability spot-check | admin block/dismiss/resolve + ConfirmDialog Escape + portal theme/locale — **PASS** (`--retries=0`) |
| Keyboard / focus matrix | `e2e/a11y-keyboard-208.spec.ts` + `confirm-dialog-escape` — **PASS** (Tab/Enter on home/login/catalog/dashboard; ConfirmDialog focus-in + Escape; EN↔UK locale; theme via keyboard) |
| Screen reader | Full NVDA/VoiceOver **not run** (optional stretch). Semantic roles/names covered via Playwright + axe. |
| Environment | Docker Postgres healthy. Prefer Node ≥20.19 locally (`nvs use 20.19.0`) so `prisma generate` / migrate work; Node 20.18 hits Prisma/`zeptomatch` ESM issues. |
## Findings (sanitized)

| ID | Severity | Surfaces | Status |
| --- | --- | --- | --- |
| color-contrast | serious | Light accent / muted on soft backgrounds | **Fixed** |
| link-in-text-block | serious | Notification settings + register privacy/terms inline links | **Fixed** (`underline`) |
| color-contrast | serious | Dark filled `bg-accent` + `text-white` (~2.46:1) | **Fixed** (`--accent-foreground`) |
| color-contrast | serious | Dark `text-red-700` availability labels | **Fixed** (`dark:text-red-400`) |
| target-size | serious | Brand link obscured by signed-in mobile header chrome | **Fixed** (hide portal nav when authenticated; compact session cluster; `min-h-11` brand) |

## Limitations (honest)

- Automated axe + Playwright keyboard ≠ full WCAG 2.2 AA conformance claim.
- No NVDA/VoiceOver pass in this issue.
- Lighthouse a11y category not collected (axe + keyboard used as primary free evidence).
- Local parallel fixture load can stress Postgres; authenticated axe describe stays serial.

**Status:** Verification + confirmed fixes complete on branch; stop before PR pending owner.
