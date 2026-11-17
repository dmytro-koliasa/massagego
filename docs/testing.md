# Testing

Local setup for **unit**, **integration**, and **E2E** tests. CI is deferred to a later PR.

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

## E2E (Playwright)

- Config: `playwright.config.ts`
- Starts `next dev` on port **3001** via `webServer` (or reuses an already running server when not in CI)
- Uses `TEST_DATABASE_URL` as `DATABASE_URL` for the app process when set
- Smoke specs: home brand visible; `/admin/login` heading + form fields

`BASE_URL` overrides the default `http://127.0.0.1:3001`.  
`E2E_PORT` overrides the port used by `webServer`.

## Layout

```text
tests/unit/          # pure logic / helpers
tests/integration/   # API + database
e2e/                 # browser flows (Playwright)
```
