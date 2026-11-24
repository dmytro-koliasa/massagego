# Spec: P2 tests and deps

Issues: #182–#186 · Parent: #92 Phase 8 · Constitution: [../constitution.md](../constitution.md)

Approved: 2026-11-24

## User Scenarios

1. **Contributor opens a PR** — CI runs lint/unit/integration **and** a Playwright smoke job so auth/booking regressions are caught without running the full local e2e suite.
2. **Masseur manages gallery** — E2E covers upload → (crop if required by UI) → image visible → delete (#183).
3. **Masseur edits availability** — E2E covers add slot(s) → save → visible after reload (#184).
4. **New client registers and later deletes account** — E2E happy paths (#185); masseur register/delete and heavy negatives out of this feature’s depth.
5. **Maintainer triages npm audit** — safe fixes applied; Prisma 7 (and similar majors) deferred via a dedicated follow-up issue (#186).

Actors: CI runner, masseur, client, maintainer.

## Functional Requirements

- **FR-1 (#182):** Add a CI job (separate from lint/unit) that:
  - Uses Postgres service + migrated `massage_test`
  - Installs Playwright Chromium (+ OS deps as needed)
  - Starts the app the same way Playwright config expects (`webServer` / port 3001 pattern)
  - Runs **base smoke**: boot check (`home` and/or `legal`), `client-login-success`, `masseur-login-success`, `booking-happy-path`
  - Also runs the **new** specs from this feature (#183–#185) once present
  - Does **not** run the full `e2e/` tree on every PR
- **FR-2 (#183):** Add Playwright happy-path for gallery upload → crop if UI requires → assert visible → delete.
- **FR-3 (#184):** Add Playwright happy-path for adding availability hour(s) → save → assert persisted (reload or re-open calendar).
- **FR-4 (#185):** Add Playwright happy-paths for **client** registration and **client** account delete. Not both portals; not exhaustive validation negatives.
- **FR-5:** Reuse existing e2e helpers/fixtures patterns (`signInAs*`, ensure-* fixtures); add new helpers only when needed.
- **FR-6 (#186):** Produce a written triage of current `npm audit --omit=dev` findings (reachable? impact?). Apply `npm audit fix` **without** `--force` when safe. Open a follow-up GitHub issue for **Prisma 7** (and note other deferred majors). Do not bump Prisma 7 / leave next-auth beta / breaking Blob major in this feature.
- **FR-7:** Update `docs/testing.md` to document CI smoke vs local-only full e2e.

## Experience

E2E drives **existing** UI only — no new product screens. Specs must match current EN/UK copy patterns and existing dialogs (gallery crop modal, confirm delete, availability calendar, register/delete flows). No ux.md/prototype required beyond “match live UI.”

## Non-Functional Requirements

- **NFR-1:** Chromium only; CI retries as in `playwright.config.ts` (1 on CI).
- **NFR-2:** Job timeout budget ~25–30 minutes; keep smoke set small enough to fit free `ubuntu-latest`.
- **NFR-3:** `EMAIL_PROVIDER=log`; no real Resend/Telegram; fixtures only; no secrets/PII in logs (constitution).
- **NFR-4:** Stack lock — no major upgrades in this feature without separate owner decision.
- **NFR-5:** Separate CI job for e2e-smoke (cleaner timeouts than stuffing into lint job).

## Success Criteria

- **SC-1:** PR CI shows green e2e-smoke job running base smoke + #183–#185 specs. (FR-1)
- **SC-2:** Gallery E2E file exists and passes. (FR-2)
- **SC-3:** Availability E2E file exists and passes. (FR-3)
- **SC-4:** Client register + client delete E2E exist and pass. (FR-4)
- **SC-5:** #186 triage documented; safe audit fixes merged if any; Prisma 7 follow-up issue opened. (FR-6)
- **SC-6:** `docs/testing.md` updated for CI vs local. (FR-7)

## Out of Scope

- Full `e2e/` on every PR; nightly full suite (deferred)
- Prisma 7 / next-auth leave-beta / breaking `@vercel/blob` major in this PR
- Masseur registration/delete E2E; gallery cap/edge negatives; availability week-copy E2E
- Firefox/WebKit; paid runners
- P0 host/legal; P3 refactor; P4 landing; P5 backlog

## Open Questions

(none)
