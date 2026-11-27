# Issue #207 — Portal composition and data fetching (Phase A)

Branch: `feat/207-portal-composition`

## Approved decisions (AD-1 … AD-6)

| ID | Verdict | Scope |
| --- | --- | --- |
| AD-1 | C+ Controlled Phase A | Catalog seed + URL filters; notification seed; AdminShell server/client; PortalLoginShell |
| AD-2 | C+ Shared DAL | RSC → DAL → Prisma; Route Handler → DAL → Prisma |
| AD-3 | B+ URL search params | `/client?city=…&page=…` + safe deep-link restore via `next` |
| AD-4 | B+ PortalLoginShell | Thin login pages + shared shell + existing auth island |
| AD-5 | A+ Defer gallery | **No** DashboardView gallery seeding in #207 |
| AD-6 | A+ Single PR | Atomic commits; stop before PR creation |

Phase B (MasseurBookingView / About) is excluded.

## Shared DAL

- `src/lib/masseur-catalog-query.ts` — catalog query + normalize + serialize
- `src/lib/notifications/preferences-payload.ts` — preferences + Telegram status
- Inbox continues to use `listInAppNotifications` (`server-only`)

API routes `GET /api/masseurs` and `GET /api/notifications/preferences` call the same helpers. Authorization remains in route handlers / page gates.

## URL catalog state

- Source of truth: App Router `searchParams` on `/client`
- Helpers: `src/lib/catalog-url.ts`
- Client navigates with `router.push` / `replace` only (no duplicate client GET for the same query)
- Proxy / Auth.js `authorized` preserve path **and** query in `next`
- Open-redirect rejection via `resolveSafePortalCallback` (includes encoded/double-encoded traversal decode)

## Deferred (documented, no new issue auto-created)

Dashboard gallery RSC seeding remains a future optimization requiring measurable benefit evidence. MasseurBookingView is out of scope.

## Admin `next` credential behavior (pre-existing)

`AdminAuthPanel` still `router.push(portalDefaultCallback("admin"))` after credentials and ignores `next`. `AdminLoginClient` may later `replace(callbackUrl)` when the session is already authenticated. This is **outside AD-4** (client/masseur login composition) and was **not** changed in #207. Impact on approved #207 deep-link requirements: **none** (catalog deep links are client-portal only).

## Pre-PR verification retrospective (actual measurements)

### Environment

| Item | Value |
| --- | --- |
| Baseline SHA | `d09a5fa56526b0e84878e57584e2bae59a1f65d9` |
| Feature SHA (implementation) | `cc8676aadf296e166e511e569a7be3c52afe2eda` |
| Method | Isolated worktrees under `%TEMP%\mg-207-base` / `mg-207-feat` |
| Runtime builds | `next build --webpack` + `next start` (ports 3101 / 3102) |
| Browser capture | Playwright Chromium, 3 runs, medians |
| Locale / actor | English UI, client fixture `+380501000001` |

Artifacts: `%TEMP%\mg-207-analyze\` (`perf-base.json`, `perf-feat.json`, `perf-compare.json`, analyze exports).

### Performance medians (localhost production)

| Metric | Baseline | Feature | Δ |
| --- | --- | --- | --- |
| `/client` `GET /api/masseurs` count | 2 | 0 | −2 |
| `/client` API total | 7 | 5 | −2 |
| `/client` TTFB (`responseStart`) | 19 ms | 22 ms | +3 ms |
| `/client` time to city filter visible | 181 ms | 124 ms | −57 ms |
| `/client` document transferSize | 19 403 B | 24 162 B | +4 759 B |
| `/client` document encodedBodySize | 19 103 B | 23 862 B | +4 759 B |
| `/client` document decodedBodySize | 19 103 B | 23 862 B | +4 759 B |
| `/client` JS encodedBodySize (resource timing) | 1 225 392 B | 1 225 052 B | −340 B |
| `/client` JS transferSize | 0* | 0* | 0 |
| `/client/notifications` prefs GET | 1 | 0 | −1 |
| `/client/notifications` inbox GET | 1 | 0 | −1 |
| `/client/notifications` API total | 4 | 2 | −2 |
| `/client/notifications` TTFB | 16.6 ms | 19 ms | +2.4 ms |
| `/client/notifications` heading visible | 386 ms | 389 ms | +3 ms |
| `/client/notifications` document transferSize | 18 473 B | 22 193 B | +3 720 B |
| Filter change `GET /api/masseurs` | 1 | 0 | −1 |

\* `transferSize` 0 indicates disk/memory HTTP cache for JS chunks; encoded/decoded sizes remain meaningful.

**Improvements:** eliminated catalog/prefs/inbox hydrate GETs; faster catalog first paint; filter navigation without catalog API duplicate.

**Regressions / trade-offs:** document/RSC HTML payload larger (~+4.8 KB catalog, ~+3.7 KB notifications); TTFB slightly higher on localhost (noise-level).

**Filter navigation:** feature run recorded no `/api/masseurs` after city change (RSC navigation only). Remaining API calls were session/profile (not catalog).

Console/page errors during capture: none.

### Bundle / module graph (`next analyze`)

Note: `next analyze` builds a **Turbopack** analyzer graph; production runtime uses **webpack**. Treat analyze as module-graph evidence, not identical webpack chunk hashes.

Client-dependency scan (ident membership, not string fingerprint alone):

| Module | Variants present | Disposition |
| --- | --- | --- |
| `masseur-catalog-query.ts` | `[app-rsc]`, `[app-route]` only | suppressed (server-only) |
| `preferences-payload.ts` | `[app-rsc]`, `[app-route]` only | suppressed (server-only) |
| `lib/prisma.ts` / `generated/prisma/*` | `[app-rsc]`, `[app-route]` only | suppressed (server-only) |
| Client variant hits for DAL/Prisma | **0** | PASS |

Attributed browser part bytes (compressed, focus routes, turbopack analyze):

| Route | Baseline compressed | Feature compressed | Δ |
| --- | --- | --- | --- |
| `/client` | 790 721 | 791 887 | +1 166 |
| `/client/notifications` | 589 724 | 591 037 | +1 313 |
| `/client/login` | 818 942 | 820 448 | +1 506 |
| `/masseur/login` | 818 986 | 820 448 | +1 462 |
| `/admin` | 587 763 | 588 939 | +1 176 |

Small compressed increases; no DAL/Prisma client leak.

### Security follow-up

- Added encoded / double-encoded / traversal unit cases.
- Hardened `resolveSafePortalCallback` to repeatedly decode pathname then re-normalize before portal checks.
- Legitimate catalog deep links with query encoding still allowed.
- Admin credential `next` ignore: documented pre-existing; out of #207 scope.

### E2E (production `next start`, `DATABASE_URL=TEST_DATABASE_URL`)

| Suite | Result |
| --- | --- |
| Non-admin Playwright (grep-invert admin/ConfirmDialog) | **34 passed / 34** |
| Admin suite (login, block, unblock, complaints, ConfirmDialog Escape) | **PASS** with isolated CI-only `ADMIN_BOOTSTRAP_*` on `massage_test` (not production) |
| Catalog URL / deep-link / malicious next | PASS |
| Booking + availability (#216) | PASS |
| Notification inbox after seed (updated assertions) | PASS |
| Targeted a11y/theme/locale (`e2e/portal-a11y-theme-locale-207.spec.ts`) | **PASS** (5/5) |

E2E adaptations (in-scope): inbox tests no longer require hydrate `GET /api/notifications/inbox`; case-insensitive auth button matchers for dictionary Title Case; ConfirmDialog Escape asserts exact status text (avoids matching the always-visible “Blocked at” label). CI `e2e-smoke` now runs the full Playwright suite with isolated admin bootstrap env.

### SEO / a11y / browser

| Check | Result |
| --- | --- |
| Login / portal layouts `robots` (`portalRobots`) | `noindex, nofollow, nocache` PASS (unchanged) |
| Home `robots` | `index, follow` PASS |
| Automated axe/Lighthouse a11y | **NOT RUN** (axe-core only transitive; no approved `@axe-core/playwright` workflow) |
| Role/label/keyboard E2E (catalog, logins, notifications, AdminShell) | **PASS** |
| Theme toggle on changed surfaces | **PASS** (targeted #207 suite) |
| Locale toggle EN↔UK on changed surfaces | **PASS** (targeted #207 suite) |
| Hydration console errors in perf capture | none observed |

### Quality gates after verification fixes

- Unit: PASS (257)
- DAL integration: PASS
- Lint / typecheck: run as part of verification commit gate
- Production build: PASS

### Pre-merge flaky E2E recheck (retries disabled)

CI run `45981934770` reported **5 flaky** (passed on retry). Re-run against local production (`next build` + `next start`, `--retries=0 --workers=1`, isolated CI-only `ADMIN_BOOTSTRAP_*` on `massage_test`):

| Spec | Result |
| --- | --- |
| `admin-dismiss-complaint` | **PASS** |
| `admin-block-client` | **PASS** |
| `booking-masseur-report` | **PASS** |
| `client-delete-account` | **PASS** |
| `portal-a11y-theme-locale-207` (admin shell nav) | **PASS** |
| Attention: `confirm-dialog-escape`, `admin-unblock-client` | **PASS** |

Classification: parallel CI / auth rate-limit / harness timing — **not** an in-scope application regression for #207. Remaining E2E stability and axe-core gaps belong to existing planned Quality issue [#208](https://github.com/dmytro-koliasa/massagego/issues/208) (do not open a new issue from #207).

### Vercel Preview

Preview deployments on this PR report **FAIL**. Exact root cause of the current preview failure was **not independently verified**: `npx vercel inspect <deployment> --logs` stalled with no usable output. Do not treat the underlying cause as confirmed. Local and GitHub Actions production builds remain **PASS**. Per owner decision, this previously accepted Preview failure is non-blocking for #207; do not change deployment configuration in this issue.

## Behavior preservation

Booking rules, gallery mutations, calendar E2E (#216), auth workflows, API contracts, schema, i18n architecture, and theme behavior are unchanged except the approved AD-3 URL persistence for the client catalog.
