# P2 tests and deps - resume

## Layout

- Branch: `feat/002-p2-tests-and-deps` (from `master` / `origin/master`)
- Feature folder: `D:\projects\massage-app\specs\002-p2-tests-and-deps\`
- Integration worktree: main checkout (no parallel worktrees)

### Code map (T001, by symbol)

| Symbol / concern | File(s) as of T001 |
| --- | --- |
| Playwright config (`webServer`, port 3001, `EMAIL_PROVIDER=log`, Chromium-only `projects`) | `playwright.config.ts` |
| CI workflow (lint-and-test only; **no** `e2e-smoke` yet) | `.github/workflows/ci.yml` |
| `usesBlobStorage` / local uploads when no `BLOB_READ_WRITE_TOKEN` → `/uploads/...` under `public/` | `src/lib/uploads.ts` |
| `signInAsMasseur` | `e2e/helpers/masseur-auth.ts` |
| `signInAsClient` | `e2e/helpers/client-auth.ts` |
| `ensureBookingFixture` | `e2e/helpers/ensure-booking-fixture.ts` |
| `MasseurGallery` | `src/components/masseur-gallery.tsx` |
| `GalleryCropModal` | `src/components/gallery-crop-modal.tsx` |
| `DeleteAccountSection` | `src/components/delete-account-section.tsx` |
| Client register tab / Create account copy | `src/lib/i18n.ts` (`authTabRegister`, `authCreateAccount`); UI in `src/components/masseur-auth-panel.tsx`; page smoke copy in `e2e/client-login.spec.ts` |
| Availability calendar (select → `toggleSlot`) | `src/components/masseur-availability-calendar.tsx` (used from `masseur-dashboard.tsx`) |
| Client profile delete UI host | `src/components/client-profile-card.tsx` embeds `DeleteAccountSection` |

**NFR-1:** Playwright `projects` = single `chromium` only (confirmed).

**Upload for gallery CI:** without `BLOB_READ_WRITE_TOKEN`, `storeUpload` writes local files and returns `/uploads/{folder}/{filename}` (confirmed).

### Base smoke filenames that exist today (for FR-1)

- `e2e/home.spec.ts`
- `e2e/legal.spec.ts`
- `e2e/client-login-success.spec.ts`
- `e2e/masseur-login-success.spec.ts`
- `e2e/booking-happy-path.spec.ts`

Added this feature: `masseur-gallery`, `masseur-availability-add`, `client-register`, `client-delete-account`.

### Baselines (T001)

| Check | Result | Command / note |
| --- | --- | --- |
| `TEST_DATABASE_URL` | **set** (length 70; value not logged) | PowerShell `$env:TEST_DATABASE_URL` |
| Docker Postgres | **up / healthy** on `:5432` (`massage-app-db-1`, postgres:16-alpine) | `docker compose ps` |
| `@playwright/test` | `^1.57.0` | `package.json` |
| `npm audit --omit=dev` | **10 high** (0 critical); matches plan snapshot | `npm audit --omit=dev` |
| CI Playwright | absent | no `playwright` / `e2e-smoke` in `ci.yml` |

**Shell note for next cards:** keep `TEST_DATABASE_URL` exported in the session; DB already healthy — run `npm run db:test:prepare` if migrations lag.

## Pins

- Prisma 7 upgrade issue: https://github.com/dmytro-koliasa/massagego/issues/193
- Audit parent: https://github.com/dmytro-koliasa/massagego/issues/186

## Deploy lock

free

## Switch states

(n/a)

## Decisions (spec Open Questions)

| # | question | recommended | needed before | answer | by, when |
| --- | --- | --- | --- | --- | --- |

## Approvals

| # | card | step | why | status | answer |
| --- | --- | --- | --- | --- | --- |

## Blockers

- (none)

## Status

| card | title | status | branch | commit | date (UTC) |
| --- | --- | --- | --- | --- | --- |
| T001 | Re-verify, branch, RESUME, code map | done | feat/002-p2-tests-and-deps | 34da43f | 2026-11-24 |
| T002 | Masseur gallery E2E | done | feat/002-p2-tests-and-deps | b1eab23 | 2026-11-24 |
| T003 | Masseur availability-add E2E | done | feat/002-p2-tests-and-deps | b1eab23 | 2026-11-24 |
| B1 | Masseur E2E (gallery + availability) | done | feat/002-p2-tests-and-deps | b1eab23 | 2026-11-24 |
| T004 | Client register E2E | done | feat/002-p2-tests-and-deps | 155b567 | 2026-11-24 |
| T005 | Client delete-account E2E | done | feat/002-p2-tests-and-deps | 155b567 | 2026-11-24 |
| B2 | Client E2E (register + delete) | done | feat/002-p2-tests-and-deps | 155b567 | 2026-11-24 |
| T006 | CI e2e-smoke job | done | feat/002-p2-tests-and-deps | ce5cb75 | 2026-11-24 |
| T007 | Update docs/testing.md | done | feat/002-p2-tests-and-deps | ce5cb75 | 2026-11-24 |
| B3 | CI smoke + docs | done | feat/002-p2-tests-and-deps | ce5cb75 | 2026-11-24 |
| T008 | npm audit triage + safe fix + Prisma 7 issue | done | feat/002-p2-tests-and-deps | 880e146 | 2026-11-24 |
| CPA | P2 stage merged and pinned | todo | | | |
| T009 | Close: results against success criteria | todo | | | |
| CPEND | Feature done | todo | | | |
