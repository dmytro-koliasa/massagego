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

1. Create a Postgres database (Vercel Postgres, Neon, or Supabase) and set `DATABASE_URL`.
2. Create a Vercel Blob store and set `BLOB_READ_WRITE_TOKEN`.
3. Set Auth env vars:
   - `AUTH_SECRET` (e.g. `npx auth secret`)
   - `AUTH_URL` = your production URL (`https://….vercel.app`)
   - optional `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` with matching callback URLs
4. Deploy. Build runs `prisma migrate deploy` automatically.

Google redirect URIs must match:

- `https://YOUR_DOMAIN/api/auth/masseur/callback/google`
- `https://YOUR_DOMAIN/api/auth/client/callback/google`

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run db:up` | Start local Postgres (Docker) |
| `npm run db:migrate` | Apply migrations (`migrate deploy`) |
| `npm run db:migrate:dev` | Create/apply migrations in development |
| `npm run db:studio` | Prisma Studio |
