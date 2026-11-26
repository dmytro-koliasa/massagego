---
name: massagego-i18n-best-practices
description: >
  MassageGo English/Ukrainian localization: custom dictionaries in src/lib/i18n,
  server-first locale cookies, LanguageProvider hydration, type-safe Dictionary
  keys, Ukrainian pluralization and formatting, localized errors/forms/metadata,
  and international SEO proposals (hreflang, canonical, sitemap, html lang).
  Use for translation keys, locale bugs, hydration mismatches, or i18n SEO.
  Do not migrate libraries, add RTL, or change routing unless explicitly approved.
license: MIT
metadata:
  author: massagego
  version: "1.0.0"
  locales: "en,uk"
  library: custom-dictionaries
---

# MassageGo i18n best practices

Preserve the **current** architecture: custom dictionaries (`en` / `uk`), `Locale` union, `LanguageProvider`, locale cookie `serein-locale`. Do **not** introduce a new i18n library, force RTL, or migrate routing unless the user explicitly approves a separate change.

## Current architecture (inspect first)

| Piece | Location / behavior |
| --- | --- |
| Locales | `src/lib/i18n/types.ts` — `'en' \| 'uk'` |
| Dictionaries | `src/lib/i18n/en.ts`, `uk.ts` |
| Barrel | `src/lib/i18n/index.ts` — `dictionaries`, `Dictionary` |
| Client provider | `src/components/language-provider.tsx` — `t`, `locale`, `setLocale` |
| Persistence | `localStorage` + cookie `serein-locale` |
| `html lang` | Set from locale (`en` / `uk`) on server cookie read and client hydrate |
| Catalog copy | Some labels also in `src/lib/masseur-catalog.ts` (keep in sync mentally) |

Before changing anything, read these files and matching call sites.

## Responsibilities vs other skills

| Concern | Owner skill |
| --- | --- |
| Dictionary keys, hydration, plurals, forms, locale UX | **This skill** |
| Next.js `metadata` / App Router SEO APIs | `nextjs-seo` |
| SEO audit methodology, GSC, crawl evidence | `seo-audit-hardened` |
| JSON-LD / schema.org types | `schema` |
| RSC boundaries, caching, Next.js APIs | `nextjs` (+ project `AGENTS.md`) |
| Client bundle / deferral | `next-bundle-optimizer-hardened` |
| React composition / unnecessary client JS | `vercel-composition-patterns` / `react-best-practices` |

International SEO **architecture** changes (path-based locales, automatic hreflang) are **proposals only** here — do not apply without explicit approval. Coordinate proposals with `seo-audit-hardened` + `nextjs-seo`.

## Server-first localization

1. Prefer resolving locale on the server from the `serein-locale` cookie (see root layout patterns).
2. Pass the needed strings or `locale` into Server Components; avoid shipping the entire dictionary to the client when a page only needs a few keys.
3. Keep `LanguageProvider` for interactive locale switching; do not expand client translation payloads casually.
4. New UI: add keys to **both** `en.ts` and `uk.ts` in the same change.

## Type-safe keys

- Use `Dictionary` / `typeof en` so key access stays typed.
- Prefer `t.someKey` over stringly-typed lookups.
- When adding nested groups, keep `en` and `uk` shapes identical so `Dictionary` stays a single source of truth.

## Missing and unused keys

- Adding a key in one locale only is a defect.
- Grep for `t.` / dictionary key names when removing UI.
- Flag hardcoded user-facing English/Ukrainian in components that should use `t` or shared helpers.
- Catalog-specific strings outside dictionaries must stay bilingual and consistent.

## Ukrainian pluralization

Ukrainian plural rules differ from English (one / few / many). For counts:

- Do not reuse English `{count} items` patterns blindly.
- Prefer explicit locale branches or helper functions with Ukrainian forms.
- Use `Intl.PluralRules('uk')` when implementing new plural helpers.
- Keep existing product wording unless expanding with reviewed Ukrainian copy.

## Dates, time zones, currencies, formatting

- Use `Intl` APIs with `uk` or `en` / `en-GB` as already patterned in catalog helpers.
- Respect masseur/user time zones already modeled in the app; do not assume browser-local only for booking labels.
- Currency: format with `Intl.NumberFormat` and the appropriate currency code when displaying money; do not hardcode symbols inconsistently across locales.
- Avoid `toLocaleString()` without an explicit locale argument in shared UI.

## Hydration consistency

- Server-rendered `lang` and first paint must match the cookie locale when present.
- Client hydrate via `useSyncExternalStore` / existing provider patterns — do not introduce a flash of the wrong language.
- Do not render locale-dependent text differently on server vs first client render for the same cookie.
- Theme and locale scripts in root layout must stay consistent with provider keys (`serein-locale`).

## Errors, forms, validation

- User-visible validation and API error messages should go through dictionaries or bilingual helpers.
- Do not surface raw Zod/English-only paths to end users when `t` already has keys.
- Admin and auth strings already in dictionaries — extend those tables rather than inlining.

## Localized metadata

- Page `title` / `description` should reflect locale when metadata is user-facing.
- Coordinate with `nextjs-seo` for `generateMetadata` patterns.
- Do not invent alternate-link tags in code without an approved SEO architecture decision.

## International SEO (proposals)

When asked about SEO + locale, **propose** (do not auto-apply):

- `hreflang` / `x-default` strategy for `en` + `uk`
- Canonical URLs per locale representation
- Sitemap locale annotations
- Consistent `html lang`
- Avoiding duplicate-content pitfalls with cookie-only locale (document tradeoffs)

Validate proposals against Google international SEO docs and installed Next.js docs. Implementation belongs in a dedicated approved change set.

## Testing and code review checklist

- [ ] Keys added to both `en` and `uk`
- [ ] Types still compile (`Dictionary` assignability)
- [ ] No hydration mismatch for cookie locale
- [ ] `document.documentElement.lang` updates on switch
- [ ] Plurals/dates reviewed for `uk`
- [ ] No new i18n library / RTL / route migration unless explicitly requested
- [ ] SEO/hreflang work filed as proposal or separate approved task
- [ ] Client bundle: avoid importing full dictionaries into unrelated client islands

## Out of scope

- RTL support  
- next-intl / next-i18next / paraglide migrations  
- Automatic locale-prefixed routing migration  
- Paid translation APIs  
- Changing application architecture without approval  
