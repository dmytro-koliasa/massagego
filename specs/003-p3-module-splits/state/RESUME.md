# P3 module splits — resume

## Layout
- Branch: `feat/003-p3-module-splits`
- Feature folder: `specs/003-p3-module-splits/`

## Status

| card | title | status | commit | date |
| --- | --- | --- | --- | --- |
| T001 | Branch + RESUME | done | 507b31a | 2026-11-24 |
| B1 / T002 | Session gates move + unify | done | 507b31a | 2026-11-24 |
| B2 / T003 | Split availability calendar | done | 1bf1232 | 2026-11-24 |
| B3 / T004 | Split masseur dashboard | done | 67b4c96 | 2026-11-24 |
| B4 / T005 | Split masseur auth panel | done | 3d330aa | 2026-11-24 |
| B5 / T006 | Split i18n | done | 271c1f2 | 2026-11-24 |
| CPA | Checkpoint | done | (this) | 2026-11-24 |
| T009 / CPEND | Results + close | doing | | 2026-11-24 |

## Pins
- Gate: `src/lib/portal-session.server.ts` (`requirePortalUser`); `notifications/portal-gate.ts` removed
- Session shape: `requireClientSession` / `requireMasseurSession` → `{ok:true}|{ok:false,response}`
- Calendar: `src/components/masseur-availability-calendar/` (main ~937 justified; dialog 353)
- Dashboard: `src/components/masseur-dashboard/` (main ~504)
- Auth panel: `src/components/masseur-auth-panel/` (main ~526)
- i18n: `src/lib/i18n/{en,uk,index,types}.ts` — public import `@/lib/i18n`
