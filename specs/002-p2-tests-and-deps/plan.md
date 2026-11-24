# Plan: P2 tests and deps

Spec: [spec.md](spec.md) · Issues #182–#186 · Constitution: [../constitution.md](../constitution.md)

Approved: 2026-11-24

## Technical Context

- Next 16, Playwright (`playwright.config.ts`: Chromium, port **3001**, `EMAIL_PROVIDER=log`, `DATABASE_URL`←`TEST_DATABASE_URL`)
- CI today: single `lint-and-test` job in `.github/workflows/ci.yml` — **no** Playwright
- Uploads: `storeUpload` → local `public/uploads/` when `BLOB_READ_WRITE_TOKEN` unset (CI OK without Blob)
- Gallery UI: `MasseurGallery` + `GalleryCropModal` on `/masseur/dashboard`
- Availability: FullCalendar on dashboard (`toggleSlot` on empty hour → Save profile); pattern from `booking-masseur-slot-unavailable.spec.ts`
- Client register: `/client/login` defaults to register tab (`Create account`)
- Client delete: `DeleteAccountSection` on client profile
- Audit snapshot (`npm audit --omit=dev`): 10 high — Prisma/`deepmerge-ts`/`effect` need `--force` → Prisma 7; nested zod via `@vercel/blob`; `undici` + `source-map-js` → safe `npm audit fix`

## Architecture / Approach

```
ci.yml
  lint-and-test (unchanged)
  e2e-smoke (NEW) ──► Postgres + migrate ──► npx playwright install --with-deps chromium
                    ──► playwright test <explicit file list>
                         base: home|legal, client-login-success, masseur-login-success, booking-happy-path
                         new: gallery, availability, client-register, client-delete
```

No product code changes except possible tiny testability hooks only if E2E blocked (prefer none). Helpers extend `e2e/helpers/*` only when shared.

## Data Model

No schema change. Fixtures reuse Prisma seed patterns (`ensure-booking-fixture` / unique emails). Gallery writes `GalleryImage` + local files under `public/uploads/gallery/`.

## Contracts / Interfaces

### CI job `e2e-smoke`

- `timeout-minutes: 30`
- Same Postgres service + `AUTH_*` / `EMAIL_PROVIDER=log` / `TEST_DATABASE_URL` as lint job; set `AUTH_URL`/`BASE_URL` to `http://127.0.0.1:3001` (Playwright webServer)
- Do **not** set `BLOB_READ_WRITE_TOKEN`
- Command: explicit file list (not `e2e/`)

### E2E specs (new files)

| File | Flow |
|---|---|
| `e2e/masseur-gallery.spec.ts` | seed masseur → signIn → dashboard gallery → file input → crop confirm if modal → visible → delete confirm → gone |
| `e2e/masseur-availability-add.spec.ts` | seed masseur (empty/known calendar) → add free hour via UI → Save → reload → slot still there |
| `e2e/client-register.spec.ts` | unique email/phone → register tab → land authenticated |
| `e2e/client-delete-account.spec.ts` | seed/register client → profile delete confirm → success toast; login rejected or account soft-deleted |

Reuse EN|UK regex copy. Tiny PNG fixture in `e2e/fixtures/` for gallery.

### Audit (#186)

1. Short triage note in PR (or issue body) — reachable vs transitive
2. `npm audit fix` (no `--force`); commit lockfile if clean
3. `gh issue create` Prisma 7 upgrade; mention deferred Blob/zod nesting + next-auth beta stay

### Docs

Update `docs/testing.md` CI table: e2e-smoke job, file list, “full e2e local-only”.

## Research

- Local uploads without Blob → gallery E2E viable on Actions
- `playwright install --with-deps chromium` on ubuntu for OS libs
- Explicit file args keep PR scope; avoid grep/project filters that silently expand
- Zod app dep already `4.6.7`; remaining zod advisory is nested under Blob — defer with Blob major

## Quickstart / Testing Approach

```bash
npm run db:up && npm run db:test:prepare
$env:TEST_DATABASE_URL="postgresql://massage:massage@localhost:5432/massage_test?schema=public"
npx playwright test e2e/home.spec.ts e2e/client-login-success.spec.ts e2e/masseur-login-success.spec.ts e2e/booking-happy-path.spec.ts e2e/masseur-gallery.spec.ts e2e/masseur-availability-add.spec.ts e2e/client-register.spec.ts e2e/client-delete-account.spec.ts
npm audit --omit=dev
```

### Test map

| Spec | Proof |
|---|---|
| FR-1 / SC-1 | `e2e-smoke` job green on PR |
| FR-2 / SC-2 | gallery spec passes |
| FR-3 / SC-3 | availability-add passes |
| FR-4 / SC-4 | client-register + client-delete pass |
| FR-6 / SC-5 | triage + safe fix + Prisma 7 issue |
| FR-7 / SC-6 | `docs/testing.md` |

### Files likely touched

- `.github/workflows/ci.yml`
- `e2e/masseur-gallery.spec.ts`, `e2e/masseur-availability-add.spec.ts`, `e2e/client-register.spec.ts`, `e2e/client-delete-account.spec.ts`
- `e2e/fixtures/*` (image), maybe small helper
- `docs/testing.md`
- `package-lock.json` (if audit fix)
- GitHub issue (Prisma 7)

## Where plan differs from a naive reading of issues

1. Smoke = **named files**, not “all smoke-tagged”
2. Gallery CI uses **local disk** uploads, not Blob
3. Safe audit ≠ zero advisories (Prisma 7 / Blob deferred)
