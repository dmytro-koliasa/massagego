# Local email (Resend)

Send real transactional email from your machine **without** Vercel deploy or a custom domain. Production domain, Vercel Cron, Telegram webhook, and paid hosting stay deferred.

App code already supports Resend (`EMAIL_PROVIDER=resend`). Default remains `log` (console only).

## 1. Resend account (free tier)

1. Sign up at [resend.com](https://resend.com) (free tier is enough for development).
2. Create an API key.
3. Until you verify your own domain, send only to **the email address of your Resend account**, using the shared sender `onboarding@resend.dev`.

Do not commit the API key. Keep it in local `.env` only.

## 2. Local `.env`

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxxxxx
EMAIL_FROM=MassageGo <onboarding@resend.dev>
AUTH_URL=http://localhost:3000
# Optional. If set, local cron must send the same Bearer token.
# CRON_SECRET=
```

Restart `npm run dev` after changing env.

With `EMAIL_PROVIDER` unset or `log`, messages only print in the server console — useful when you do not want to hit Resend.

## 3. Drain the outbox (local cron)

Vercel Cron is not used locally. With the app running:

```bash
npm run cron:notifications
```

That calls `GET http://localhost:3000/api/cron/notifications` (override base with `CRON_BASE_URL` or `AUTH_URL`). If `CRON_SECRET` is set in `.env`, the script sends `Authorization: Bearer …`.

## 4. Manual checklist

1. `npm run db:up` and `npm run dev`.
2. Use a **verified** client/masseur email that matches your Resend account inbox (required with `onboarding@resend.dev`).
3. Trigger a notification (for example book a slot, or cancel a booking).
4. Confirm a row appears in `NotificationOutbox` (Prisma Studio: `npm run db:studio`) if the immediate send failed, or that email arrived if the immediate send succeeded.
5. If status is `pending` / `failed`, run `npm run cron:notifications` and check the inbox again.

Verification and password-reset emails use the same `sendEmail` adapter — they also need `EMAIL_PROVIDER=resend` and a reachable recipient under the free sender limits.

## Deferred (separate tasks)

- Vercel project, production env, and billing
- Custom Resend domain / production `EMAIL_FROM`
- Telegram bot + public webhook
- Paid CI runners (free GitHub Actions CI is separate — see [testing.md](../testing.md))
