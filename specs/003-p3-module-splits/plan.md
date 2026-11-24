# Plan: P3 module splits (#187)

## Primary goal
Developers can change calendar, dashboard, auth, i18n, or session gates without editing 800–1300 line blobs or looking under `notifications/` for auth.

## Approach
Thin sequential batches on `feat/003-p3-module-splits`. Behavior-preserving refactors only. Prefer extract-module over rewrite.

### Target gate shape (unify toward)
```ts
{ ok: true; userId: string; /* extras */ } | { ok: false; response: NextResponse }
```
- Already: `requireAdmin`, `requirePortalUser`
- Migrate: `requireClientSession` (`status`/`error` → `response`), `requireMasseurSession` (`error` → `ok:false,response`)

### Batches
| Batch | Work |
| --- | --- |
| B1 | Move `requirePortalUser` → `src/lib/portal-session.server.ts`; re-export shim from old path optional then delete; unify all four gate shapes + call sites |
| B2 | Split availability calendar into folder modules (nav, event render, slot actions, main) |
| B3 | Split masseur dashboard |
| B4 | Split masseur auth panel |
| B5 | Split i18n by locale files + domain slices |
| CPA | Full check; link PRs on #187 |

## Testing
- `npm test`, `npm run typecheck`, `npx eslint src tests e2e`
- Smoke: existing CI e2e-smoke list after B1 and at CPA
