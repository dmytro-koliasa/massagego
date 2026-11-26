# MassageGo i18n architecture notes

## Dictionary pattern

- `en` and `uk` objects should remain structurally aligned.
- `Dictionary` is derived from `typeof dictionaries[Locale]`.
- Prefer extending existing key groups over creating parallel string tables.

## Locale persistence

- Cookie + localStorage key: `serein-locale`
- Values: `en` | `uk`
- Root layout reads cookie for SSR `lang` and provider initial state.

## Split copy

Some catalog labels live in `src/lib/masseur-catalog.ts` with inline `locale === "uk"` branches. When editing booking/catalog UX, update those helpers and dictionaries consistently.

## SEO coupling

Cookie-based locale without URL prefixes has SEO tradeoffs (shared URL, crawler locale ambiguity). Document proposals; do not silently add middleware locale routing.
