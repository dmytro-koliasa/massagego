# Spec: P3 module splits (#187)

## Goal
Improve maintainability by splitting oversized UI/i18n modules and placing session gates in a shared auth location — **no intentional behavior or visual changes**.

## In scope
1. Split `masseur-availability-calendar.tsx`, `masseur-dashboard.tsx`, `masseur-auth-panel.tsx` so no new god file stays > ~500 lines without justification.
2. Break `src/lib/i18n.ts` by domain and/or locale.
3. Unify session-gate return shapes across client / masseur / admin / portal gates.
4. Move `requirePortalUser` out of `src/lib/notifications/portal-gate.ts` into a shared session module.

## Out of scope
- Visual redesign (P4)
- Behavior changes (except preserving #177 blockedAt rejection)
- Paid services / deploy

## Success criteria
- SC-1: Gate module lives outside `notifications/`; imports updated; tests green.
- SC-2: Gate return shapes share one discriminated pattern; call sites updated.
- SC-3: Each of the three UI files is split; no replacement god files > ~500 lines without note in RESUME.
- SC-4: `i18n.ts` broken into domain/locale modules; app typechecks; EN/UK strings still resolve.
- SC-5: Child PRs (or one feature PR with clear commits) linked from #187; CI green.
