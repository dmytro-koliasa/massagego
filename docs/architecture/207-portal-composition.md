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
- Proxy preserves path **and** query in `next` (`src/lib/safe-internal-path.ts`)
- Open-redirect rejection via `resolveSafePortalCallback`

## Deferred (documented, no new issue auto-created)

Dashboard gallery RSC seeding remains a future optimization requiring measurable benefit evidence. MasseurBookingView is out of scope.

## Before / after (R21-DATA-01)

**Before (audit):** thin RSC gate → client mount → `GET /api/masseurs` and notification preference/inbox fetches (extra waterfall).

**After (Phase A):**

| Route | Initial data | Post-hydrate catalog/prefs GET |
| --- | --- | --- |
| `/client` | RSC → `queryMasseurCatalog` | None for catalog (filter changes = RSC navigation) |
| `/client/notifications`, `/masseur/notifications` | RSC prefs + inbox seed | None on first paint; mutations/refresh still use APIs |
| `/client/login`, `/masseur/login` | Server shell + client auth island | Unchanged auth APIs |
| Admin pages | Server `AdminShell` + `AdminNav` island | Unchanged |

Trade-off: larger RSC payload / TTFB possible vs fewer client round-trips. Measure under production build before claiming wins.

## Behavior preservation

Booking rules, gallery mutations, calendar E2E (#216), auth workflows, API contracts, schema, i18n architecture, and theme behavior are unchanged except the approved AD-3 URL persistence for the client catalog.
