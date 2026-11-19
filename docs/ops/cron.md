# Cron / scheduled jobs (#89)

Analysis only — **production host cron remains deferred**. Do not treat this file as permission to enable Vercel Cron, buy Pro, or change live hosting.

## What the app expects

| Job | Route | Purpose |
|---|---|---|
| Notifications / reminders | `GET /api/cron/notifications` | Drain `NotificationOutbox` (retries + due booking reminders) |
| Retention cleanup | `GET /api/cron/cleanup` | Cancelled/completed bookings, inbox, outbox, idle rate-limit buckets |

Auth: shared Bearer `CRON_SECRET` via `authorizeCron` (`src/lib/cron-auth.ts`). **Fail-closed in every environment** (#116): missing/empty secret or wrong Bearer → 401. Local scripts require `CRON_SECRET` in `.env`.

Declared in repo `vercel.json` today:

```json
{
  "crons": [
    { "path": "/api/cron/notifications", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/cleanup", "schedule": "0 3 * * *" }
  ]
}
```

## Plan limits (verified against Vercel docs, 2026-11-19)

**Assumption for this note:** production host/plan is **not chosen yet**. Local work uses free GitHub + local Docker only. Do not claim a production Vercel plan from this analysis.

### Legacy Cron Jobs (`vercel.json` → `"crons"`)

Source: [Usage & Pricing for Cron Jobs](https://vercel.com/docs/cron-jobs/usage-and-pricing)

| Plan | Minimum interval | Notes |
|---|---|---|
| Hobby | **Once per day** | Sub-daily expressions **fail at deploy** |
| Pro / Enterprise | Once per minute | Minute precision |

Implication for current `vercel.json`:

- `*/5 * * * *` on **Hobby (legacy Cron Jobs)** → deploy failure / unsupported.
- `0 3 * * *` cleanup → **Hobby-safe** (daily).

### Newer Schedules (beta; separate from `"crons"`)

Source: [Schedules limits](https://vercel.com/docs/schedules/limits)

| Plan | Most frequent schedule |
|---|---|
| Hobby | Every **15 minutes** (fixed 15‑minute jitter) |
| Pro / Enterprise | Every minute (configurable jitter) |

`*/5` is still too frequent for Hobby Schedules; a Hobby-compatible notifications cadence would be at best `*/15 * * * *` (plus jitter). Migrating from Cron Jobs to Schedules is a **separate hosting decision**, not done in this ticket.

## Latency impact if polls are slower than 5 minutes

Immediate path: many events still try to send right away; cron is the **retry + reminder claim** path.

| Cadence | Approx. worst-case delay for pending outbox / due reminder claim |
|---|---|
| Every 5 min (current declaration) | ~5 min (+ function cold start) |
| Every 15 min (Hobby Schedules ceiling) | ~15 min (+ up to ~15 min jitter on Hobby) |
| Daily (Hobby legacy Cron Jobs ceiling for notifications) | Up to ~24 h — **not acceptable** for session reminders or failed-email retries |
| External poller (GitHub Actions / OS scheduler / `cron:notifications:loop`) hitting the same route with `CRON_SECRET` | Whatever interval you set; same app semantics |

Reminders (`processDueBookingReminders`) only enqueue when the cron (or immediate path) runs after the reminder window opens. A 15‑minute poll means a client may get a “N hours before” reminder up to ~15–30 minutes late relative to the ideal claim time — usually acceptable; a daily poll is not.

Outbox retries use `nextAttemptAt`; slower polls delay retries but do not change max-age / dead-letter rules.

## Recommendation (deferred infra — no auto-apply)

1. **Do not enable production Vercel Cron** until host/plan is explicitly chosen.
2. Keep `vercel.json` as the **intended Pro-style** declaration for now, or change it only after a plan decision (changing it without a plan still does not turn cron on safely).
3. When a free Hobby deploy is required later, pick one of:
   - **A.** External free poller → `GET /api/cron/notifications` with `Authorization: Bearer $CRON_SECRET` every 5–15 min; keep cleanup daily on Vercel or the same poller.
   - **B.** Migrate to Vercel Schedules and use `*/15` for notifications on Hobby (accept jitter + latency).
   - **C.** Upgrade to Pro and keep `*/5` (paid — out of scope until separately approved).
4. Cleanup `0 3 * * *` can stay on Hobby either way.

**Recommended default when a free public host is eventually approved:** option **A** (external poller + `CRON_SECRET`) so reminder latency stays close to 5–15 minutes without assuming Pro. Revisit if the team later pays for Pro or adopts Schedules.

## Local verification (free)

With `npm run dev` running:

```bash
npm run cron:notifications   # one shot
npm run cron:cleanup         # one shot
npm run cron:notifications:loop   # repeat every CRON_POLL_MS (default 300000)
```

See also [email-local.md](email-local.md) for Resend + outbox drain checklist.

## Explicitly out of scope for #89

- Buying or activating Vercel Pro / paid Schedules features
- Enabling production cron or changing live Vercel project settings
- Claiming a specific production plan without owner confirmation
