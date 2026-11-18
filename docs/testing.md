# Testing

Local setup for **unit**, **integration**, and **E2E** tests. Continuous integration runs unit + integration + lint on GitHub Actions (see below). E2E stays local-only for now.

## Prerequisites

- Docker Postgres: `npm run db:up`
- Node deps: `npm install`
- Playwright browser (once): `npm run test:e2e:install`

## Databases

| Database | Purpose |
|---|---|
| `massage` | Local development (`DATABASE_URL`) |
| `massage_test` | Integration + E2E (`TEST_DATABASE_URL`) |

On a **new** Postgres volume, `docker/postgres/init/01-create-test-db.sql` creates `massage_test`.

On an **existing** volume (already had data before this change):

```bash
npm run db:test:prepare
```

That creates `massage_test` if needed and runs `prisma migrate deploy` against it.

Default URL:

```text
postgresql://massage:massage@localhost:5432/massage_test?schema=public
```

Optional in `.env` (not committed):

```env
TEST_DATABASE_URL="postgresql://massage:massage@localhost:5432/massage_test?schema=public"
```

## Commands

| Script | What it runs |
|---|---|
| `npm run test:unit` | Vitest unit tests in `tests/unit/` (no DB) |
| `npm run test:integration` | Vitest integration tests in `tests/integration/` (needs `TEST_DATABASE_URL`) |
| `npm test` | Unit then integration |
| `npm run test:e2e` | Playwright specs in `e2e/` |
| `npm run db:test:prepare` | Create/migrate `massage_test` |
| `npm run db:migrate:test` | Migrate `massage_test` only |

Without `TEST_DATABASE_URL`, integration suites that need Postgres are **skipped** (exit stays green for unit-only).

With `TEST_DATABASE_URL` set (or after `db:test:prepare` you export it), integration runs against `massage_test` only — never against the dev `massage` DB.

### Suggested local flow

```bash
npm run db:up
npm run db:test:prepare
set TEST_DATABASE_URL=postgresql://massage:massage@localhost:5432/massage_test?schema=public
npm test
npm run test:e2e:install
npm run test:e2e
```

On PowerShell use `$env:TEST_DATABASE_URL="..."`.

## Continuous integration (P-6)

Workflow: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)

| | |
|---|---|
| Triggers | `pull_request` (all branches) and `push` to `master` |
| Runner | Free `ubuntu-latest` |
| Database | Postgres 16 service container → `massage_test` |
| Steps | `npm ci` → `db:migrate:test` → `lint` → `npm test` |
| Not in CI | Playwright E2E, paid runners |

Dummy `AUTH_SECRET` / `AUTH_URL` / `EMAIL_PROVIDER=log` are set in the workflow env only.

## E2E (Playwright)

- Config: `playwright.config.ts`
- Starts `next dev` on port **3001** via `webServer` (or reuses an already running server when not in CI)
- Uses `TEST_DATABASE_URL` as `DATABASE_URL` for the app process when set
- Smoke / public specs:
  - home brand visible (`e2e/home.spec.ts`)
  - `/admin/login` heading + form fields (`e2e/admin-login.spec.ts`)
  - `/client/login` and `/masseur/login` headings + form fields
  - `/privacy` and `/terms` headings (`e2e/legal.spec.ts`)
- Auth success:
  - admin bootstrap login → `/admin` users list (`e2e/admin-login.spec.ts`; needs `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD`; upserts admin on `massage_test` via `e2e/helpers/ensure-admin.ts`)
- `next.config.ts` sets `allowedDevOrigins` for `127.0.0.1` / `localhost` so Playwright can hydrate against the `webServer` host

`BASE_URL` overrides the default `http://127.0.0.1:3001`.  
`E2E_PORT` overrides the port used by `webServer`.

## Layout

```text
tests/unit/          # pure logic / helpers
tests/integration/   # API + database
e2e/                 # browser flows (Playwright)
```
