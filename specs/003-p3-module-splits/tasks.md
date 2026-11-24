# Tasks: P3 module splits (#187)

Design: [spec.md](spec.md). Plan: [plan.md](plan.md). Constitution: [../constitution.md](../constitution.md).

## 1. Session protocol
One batch per stretch. Branch `feat/003-p3-module-splits`. State under `specs/003-p3-module-splits/state/`. No behavior/UI redesign. No `audit fix --force`. Finish: verify → commit → hand-off → RESUME.

## 2. Cards

- [x] T001 Branch, RESUME, code map of gate call sites + line counts
- [x] B1 Session gates move + unify shapes (T002)
- [ ] B2 Split availability calendar (T003)
- [ ] B3 Split masseur dashboard (T004)
- [ ] B4 Split masseur auth panel (T005)
- [ ] B5 Split i18n (T006)
- [ ] CPA Checkpoint + comment on #187
- [ ] T009 / CPEND Results + lessons; then P4

### T001
**Do:** branch from master; `state/RESUME.md`; map gate files and UI line counts.
**Verify:** on feature branch; RESUME exists.

### T002 — B1 gates
**Do:** create `src/lib/portal-session.server.ts` with `requirePortalUser`; update imports; unify `requireClientSession` / `requireMasseurSession` to `{ok}|{ok:false,response}`; fix call sites; remove or thin-shim `notifications/portal-gate.ts`.
**Verify:** typecheck + eslint + `npm test`.

### T003–T006
Split respective modules into `src/components/masseur-availability-calendar/*`, `masseur-dashboard/*`, `masseur-auth-panel/*`, and `src/lib/i18n/*` without public API breaks where avoidable (re-export barrels).

### CPA
Full check + smoke list; pin paths in RESUME; comment child commits/PR on #187.
