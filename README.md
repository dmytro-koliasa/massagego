# MassageGo

Next.js app for masseur and client portals: profiles, availability, bookings, and gallery.

## Stack

- Next.js 16 + Auth.js (credentials + optional Google)
- PostgreSQL via Prisma
- Photo uploads: [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) in production, or `public/uploads/` locally when `BLOB_READ_WRITE_TOKEN` is unset

## Local setup

1. Copy env and start Postgres:

```bash
cp .env.example .env
npm run db:up
npm install
npm run db:migrate
npm run dev
```

2. Open [http://localhost:3000](http://localhost:3000).

Optional: set `BLOB_READ_WRITE_TOKEN` to use Vercel Blob locally instead of disk.

## Deploy on Vercel

Public hosting is optional and deferred until you choose a host/plan. If you deploy later:

1. Create a Postgres database (Vercel Postgres, Neon, or Supabase) and set `DATABASE_URL`.
2. Create a Vercel Blob store and set `BLOB_READ_WRITE_TOKEN`.
3. Set Auth env vars:
   - `AUTH_SECRET` (e.g. `npx auth secret`)
   - `AUTH_URL` = your production URL (`https://….vercel.app`)
   - optional `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` with matching callback URLs
4. Deploy the app. **`npm run build` does not run migrations** (`prisma generate` + `next build` only).
5. Apply schema changes with an **explicit** migrate step (`npm run db:migrate` / `prisma migrate deploy`) against the target database — never as a side effect of compile. Do not wire automatic production/preview migrate into the build without a separate ops decision.

Google redirect URIs must match:

- `https://YOUR_DOMAIN/api/auth/masseur/callback/google`
- `https://YOUR_DOMAIN/api/auth/client/callback/google`

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run build` | Production compile (`prisma generate` + `next build`; **no** migrate) |
| `npm run db:up` | Start local Postgres (Docker) |
| `npm run db:migrate` | Apply migrations (`migrate deploy`) — explicit only |
| `npm run db:migrate:dev` | Create/apply migrations in development |
| `npm run db:migrate:test` | Migrate isolated `massage_test` only |
| `npm run db:studio` | Prisma Studio |
