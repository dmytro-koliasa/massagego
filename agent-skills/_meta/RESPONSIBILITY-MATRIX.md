# Skill responsibility and conflict matrix

| Domain | Primary | Secondary | Do not use |
| --- | --- | --- | --- |
| Bundle / client JS audit | `next-bundle-optimizer-hardened` | `vercel-composition-patterns`, `react-best-practices` | `next-bundle-optimizer` |
| Technical SEO audit | `seo-audit-hardened` | `nextjs-seo`, `schema` | `seo-audit` |
| Next Metadata API | `nextjs-seo` | `seo-audit-hardened` | — |
| JSON-LD | `schema` | `seo-audit-hardened` | — |
| en/uk dictionaries, hydration | `massagego-i18n-best-practices` | `seo-audit-hardened` (i18n SEO proposals only) | New i18n libs / RTL migrations |
| Next/React architecture | `AGENTS.md` + Next docs | Cursor `nextjs-architecture-and-seo` rule | Cache Components enablement via skills |
| OmniRoute / cli-* | N/A (unused proposal) | — | Auto-removal without approval |

## Conflict rules

1. Hardened skill wins over upstream original of the same capability.
2. Project `AGENTS.md` wins over generic skill advice when they conflict.
3. Architectural SEO/i18n changes are proposals until explicitly approved.
4. Duplicate discovery of original + hardened must not occur (restore enforces).
