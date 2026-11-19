# Pre-release gates (P-1 / P-2)

Local tooling and checklists before **real users** or a **production database**. This does **not** replace a lawyer (P-2) or a verified production DB (P-1). Vercel deploy and paid hosts stay deferred until you choose them.

## P-1 — Database constraints

Migrations `20261115120000_booking_no_overlap` and `20261116220000_client_booking_no_overlap` require `btree_gist` and two exclusion constraints. They abort if overlapping active bookings already exist.

### Local (do this anytime)

With Docker Postgres and migrations applied:

```bash
npm run db:up
npx prisma migrate deploy
npm run db:verify-constraints
```

The script checks:

- extension `btree_gist`
- constraints `Booking_no_overlapping_active_slots` and `Booking_no_overlapping_active_client_slots`
- `SHOW timezone` (printed; app booking logic uses masseur IANA zones, not this alone)
- overlapping active pair counts (masseur + client) — must be `0`

Exit code `1` means fix data or re-run migrations before treating the DB as safe.

Optional: point `DATABASE_URL` at another Postgres (staging/prod later) and run the same command — **only** when you have that database and accept the cost/risk.

### Production (gate — deferred until first prod DB)

Before the first deploy onto real data:

1. Confirm `btree_gist` is allowed on the host.
2. Run `npm run db:verify-constraints` against production `DATABASE_URL` (or equivalent SQL).
3. If overlaps > 0, cancel/move conflicting bookings, then migrate.
4. Note the server `timezone` and that booking math uses per-masseur IANA timezones ([BR-006](../business/decisions.md#br-006)).
5. Do **not** assume local Docker success means production is fine.

## P-2 — Legal / XR-1 checklist (for counsel)

Product decisions are **not** legal advice. Before real users, have counsel review at least:

| Topic | Where in product / docs |
|---|---|
| Retention: cancelled bookings ~7 days after `cancelledAt` | [BR-011](../business/decisions.md#br-011), cleanup cron |
| Retention: completed bookings ~3 months after session start | [BR-018](../business/decisions.md#br-018) |
| Account deletion / anonymisation | [BR-011](../business/decisions.md#br-011), self-service delete |
| Excluded-country list (city + phone) | [BR-013](../business/decisions.md#br-013) |
| Public masseur phone | [BR-004](../business/decisions.md#br-004) |
| Cancellation reason free text | [BR-004](../business/decisions.md#br-004) / [BR-005](../business/decisions.md#br-005) |
| Notification consent + channels (email, later Telegram) | [BR-009](../business/decisions.md#br-009) |
| Privacy policy and terms (EN/UK pages) | `/privacy`, `/terms` |
| Processors: Resend, Google OAuth, (later) Telegram, host/DB/backups | env + hosting choice |
| Backups / logs retention vs product deletion windows | host-specific |
| Admin audit log personal data | [BR-021](../business/decisions.md#br-021) |

Cross-cutting requirement: [XR-1](../business/decisions.md#cross-cutting-requirements).

## Local retention cleanup (BR-011 / BR-018)

Vercel Cron is not used locally. With Docker Postgres and `npm run dev` running:

```bash
npm run cron:cleanup
```

That calls `GET http://localhost:3000/api/cron/cleanup` (override base with `CRON_BASE_URL` or `AUTH_URL`). If `CRON_SECRET` is set in `.env`, the script sends `Authorization: Bearer …`.

The job hard-deletes cancelled bookings older than ~7 days (`cancelledAt`) and completed bookings older than ~3 months (`slotStart`), skipping rows with `hasRetentionHold`. Response JSON includes delete counts — useful to verify retention windows before a production host cron is configured.

## Telegram webhook auth (#77)

`POST /api/telegram/webhook` is **fail-closed** without `TELEGRAM_WEBHOOK_SECRET` on production-like hosts (`NODE_ENV=production` or `VERCEL_ENV=production|preview`). Invalid/missing `x-telegram-bot-api-secret-token` returns **401**.

Local-only testing without a secret requires `TELEGRAM_WEBHOOK_ALLOW_INSECURE=1` (ignored on production-like hosts). Public Telegram host registration remains deferred (P-4); do not enable the webhook on a reachable URL without a real secret.

## Related local ops

- Email without Vercel: [email-local.md](email-local.md)
- Cron / Vercel schedule analysis (deferred prod): [cron.md](cron.md)
- Tests + CI (P-6): [testing.md](../testing.md)
