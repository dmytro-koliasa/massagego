# Implementation Plan

> **Status:** plan created 2026-11-16 from the **Approved** decisions in [decisions.md](decisions.md) and the changes listed in [data-model-changes.md](data-model-changes.md). **Track-2 pull requests 1–15 are merged** (through [#20](https://github.com/dmytro-koliasa/massagego/pull/20), 2026-11-17). Follow-ups: product [#25](https://github.com/dmytro-koliasa/massagego/pull/25)–[#28](https://github.com/dmytro-koliasa/massagego/pull/28); tests/ops/CI [#22](https://github.com/dmytro-koliasa/massagego/pull/22)–[#24](https://github.com/dmytro-koliasa/massagego/pull/24), [#29](https://github.com/dmytro-koliasa/massagego/pull/29)–[#33](https://github.com/dmytro-koliasa/massagego/pull/33); local Playwright E2E [#34](https://github.com/dmytro-koliasa/massagego/pull/34)–[#60](https://github.com/dmytro-koliasa/massagego/pull/60) (public/auth smoke, client book/cancel/cutoff/Thai/sessions/complaints, masseur resolve/walk-in/report/slot, admin block/unblock/complaints/dismiss; password-reset + client login; catalogue in [testing.md](../testing.md)); docs closeout [#49](https://github.com/dmytro-koliasa/massagego/pull/49); docs hygiene [#39](https://github.com/dmytro-koliasa/massagego/pull/39), [#42](https://github.com/dmytro-koliasa/massagego/pull/42), [#43](https://github.com/dmytro-koliasa/massagego/pull/43). Product follow-ups shipped: in-app inbox [#62](https://github.com/dmytro-koliasa/massagego/pull/62), masseur bulk-cancel (X-4) [#63](https://github.com/dmytro-koliasa/massagego/pull/63), recent-cancellations deep-link [#64](https://github.com/dmytro-koliasa/massagego/pull/64), E2E [#65](https://github.com/dmytro-koliasa/massagego/pull/65)–[#67](https://github.com/dmytro-koliasa/massagego/pull/67) + AR-24 missing/pulse [#73](https://github.com/dmytro-koliasa/massagego/pull/73), dual-session `X-Portal` [#69](https://github.com/dmytro-koliasa/massagego/pull/69) + E2E [#71](https://github.com/dmytro-koliasa/massagego/pull/71); docs hygiene [#68](https://github.com/dmytro-koliasa/massagego/pull/68), [#70](https://github.com/dmytro-koliasa/massagego/pull/70), [#72](https://github.com/dmytro-koliasa/massagego/pull/72). Remaining: deferred product items (e.g. prices, payments, courses); P-1 prod DB + P-2 legal before real users (local tooling in `docs/ops/pre-release.md`); later Vercel/Telegram when chosen. CI (P-6) is on GitHub Actions — see [testing.md](../testing.md).
> The current database holds test data only and will be wiped; schema migrations are still required.

## 1. How the work is organised

- **Slicing:** by theme, 15 pull requests, ordered by dependencies (owner's choice, 2026-11-16); PR 2a was added on 2026-11-16, so there are now 16.
- **One branch and one pull request per item.** Branch names follow the content (for example `feat/booking-status-and-cancel-data`).
- **Before each pull request:** (1) the implementation details are groomed with the owner (the open sub-questions listed for it below); (2) only then is code written.
- **In each pull request:** the code, the tests, the migration (if any), the English and Ukrainian texts, and the documentation update (the rule moves into "Approved rules" in [business-rules.md](business-rules.md), the item becomes **Implemented** in [decisions.md](decisions.md), and the approved-decisions log gets the pull request).
- **No merge or push without the owner's authorisation**, as before.

### Definition of done (every pull request)

- The behaviour matches the approved decision and its acceptance criteria below.
- Automated tests cover the new rules, including the boundaries named in the criteria. Database-dependent tests run against a dedicated test database (as in the existing concurrency tests).
- The migration (if any) applies cleanly on an empty database and on the test database.
- All new user-facing texts exist in English and Ukrainian.
- The type check, the lint of the touched files and the production build pass.
- Personal data handling was reviewed against XR-1.
- The documentation is updated as described above.

## 2. Prerequisites outside the pull requests

| # | Prerequisite | Needed before |
|---|---|---|
| P-1 | Verify the production database: the migration `20261115120000_booking_no_overlap` (needs the `btree_gist` extension), overlapping active bookings, and the production server timezone. **Local tooling:** `npm run db:verify-constraints` + [pre-release.md](../ops/pre-release.md). **Still a gate:** production `DATABASE_URL` has not been verified (no prod DB in local-only phase). | the first deployment to production |
| P-2 | Legal review under XR-1: retention periods (7 days, 3 months), the excluded-country list, the public masseur phone, consent texts, the privacy policy. **Checklist:** [pre-release.md](../ops/pre-release.md) (not a substitute for counsel). | the first release to real users |
| P-3 | Choose the email provider and set up sending (domain, sender, templates). **Addressed (plan PR 12 = [#17](https://github.com/dmytro-koliasa/massagego/pull/17)):** Resend (`EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`). **Local ops:** free-tier Resend + `docs/ops/email-local.md` + `npm run cron:notifications` (no Vercel). **Deferred:** production domain/sender and host cron. | plan PR 8/9/12 (shipped) |
| P-4 | Create the Telegram bot and decide how its token is stored. **Deferred** until a public URL exists (no paid tunnel/host required during local-only development). Telegram product code is in [#18](https://github.com/dmytro-koliasa/massagego/pull/18). | plan PR 13 (shipped; host webhook still deferred) |
| P-5 | Decide where scheduled jobs run on the hosting platform and where the rate-limit counters are stored (an in-memory counter does not work across serverless instances). **Addressed:** Postgres `RateLimitBucket` + `NotificationOutbox`; Vercel Cron `*/5` notifications + daily `0 3 * * *` `/api/cron/cleanup` (plan PR 14 = [#19](https://github.com/dmytro-koliasa/massagego/pull/19); local `npm run cron:cleanup`). | plan PR 9/12/14 (shipped) |
| P-6 | Decide how the shared test database is provided in continuous integration. **Addressed:** GitHub Actions (free `ubuntu-latest`) with a Postgres 16 service → `massage_test`; triggers `pull_request` + `push` to `master`; `lint` + unit + integration (`npm test`). E2E stays local. See [testing.md](../testing.md). | PR 1 onwards (recommended) |

## 3. Order and dependencies

| № | Pull request | Decisions | Depends on |
|---|---|---|---|
| 1 | Booking statuses and cancellation data ([#4](https://github.com/dmytro-koliasa/massagego/pull/4)) | BR-005, C-8 | none |
| 2 | Masseur timezone and shared constants ([#5](https://github.com/dmytro-koliasa/massagego/pull/5)) | BR-006, BR-001, C-6 | none |
| 2a | Calendars in the masseur's timezone ([#6](https://github.com/dmytro-koliasa/massagego/pull/6)) | BR-006, C-2 | 2 |
| 3 | Availability rules ([#7](https://github.com/dmytro-koliasa/massagego/pull/7)) | BR-007, C-3, C-4 | 2, 2a |
| 4 | Booking lead time, 120-day window, cancellation cutoff ([#8](https://github.com/dmytro-koliasa/massagego/pull/8)) | BR-002, BR-003, BR-004, C-1 | 1, 2, 2a |
| 5 | Client booking and cancellation rules ([#9](https://github.com/dmytro-koliasa/massagego/pull/9)) | BR-008, BR-004, C-5, C-7, X-1 | 1, 4 |
| 6 | Thai massage hints ([#10](https://github.com/dmytro-koliasa/massagego/pull/10)) | BR-014 | 5 |
| 7 | Shared excluded-country list ([#11](https://github.com/dmytro-koliasa/massagego/pull/11)) | BR-013 | none |
| 8 | Registration and profile fields ([#12](https://github.com/dmytro-koliasa/massagego/pull/12)) | BR-017, BR-009 (fields), BR-004 (phone) | 7 |
| 9 | Password reset and rate limits ([#13](https://github.com/dmytro-koliasa/massagego/pull/13)) | BR-019, BR-020 | 8 |
| 10 | Image upload checks ([#14](https://github.com/dmytro-koliasa/massagego/pull/14)) | BR-022 | none |
| 11 | Masseur catalog ([#16](https://github.com/dmytro-koliasa/massagego/pull/16)) | BR-010, BR-017, C-9 | 2, 4, 8 |
| 12 | Email notifications ([#17](https://github.com/dmytro-koliasa/massagego/pull/17)) | BR-009 | 1, 2, 8 |
| 13 | Telegram and phone confirmation ([#18](https://github.com/dmytro-koliasa/massagego/pull/18)) | BR-009, BR-023 | 12 |
| 14 | Account deletion and data cleanup ([#19](https://github.com/dmytro-koliasa/massagego/pull/19)) | BR-011, BR-018 | 1, 12 |
| 15 | Administration panel ([#20](https://github.com/dmytro-koliasa/massagego/pull/20)) | BR-021 | 14 |

Plan PRs 1, 2, 7 and 10 had no dependencies and could start in any order or in parallel (all merged).

## 4. Pull requests

### PR 1 - Booking statuses and cancellation data

**Scope:** restrict `Booking.status` to `confirmed` and `cancelled` and rename the existing `pending` in the code, the API responses and the screens; add `cancelledBy`, `cancelledAt`, the cancellation reason (a fixed list including the system reason "client account deleted") and the free text for "Other" (up to 200 characters); both existing cancel paths (client cancel and masseur resolve) fill `cancelledBy` and `cancelledAt`; remove the unused columns `preferredDate`, `preferredTime`, `clientEmail`; correct the schema comment on `clientUserId`; index the fields the cleanup jobs will use.

**Acceptance criteria:**
- A new booking has the status `confirmed`; no code path writes another value; the existing overlap constraint still treats every non-cancelled booking as occupying the hour.
- Cancelling by the client or the masseur sets `cancelledBy` and `cancelledAt`.
- The removed columns are not referenced anywhere; the migration applies on an empty and on the test database.
- The existing concurrency tests pass unchanged.

**To groom first:** the representation of the status (database enum or constraint); the list and keys of the reasons; whether the reason is already accepted by the API here (enforcement comes in PR 5).

### PR 2 - Masseur timezone and shared constants

**Scope:** a timezone field on the masseur (IANA name); one shared module of time helpers used for hour alignment, "today", the working window and weekly copy, replacing the server-local `alignToHour`, `getHours` and `setDate` code; one shared constants module (session length 60 minutes, the working window 05:00-23:00, the 120-day window, the cap of 30 bookings, the retention periods); a helper that formats a time in the masseur's timezone with a label ("Kyiv, UTC+2").

**Acceptance criteria:**
- No booking or availability code uses the server's local time.
- Tests run with the server timezone set to UTC and the masseur timezone set to `Europe/Kyiv`, including both daylight-saving transitions.
- The constants exist in one place and the old duplicates are gone.

**Groomed (2026-11-16):** default `Europe/Kyiv` with no UI to choose it (the profile field and X-2 move to PR 8); `luxon` for the time-zone maths; label "Kyiv, UTC+2"; the calendars move to a new PR 2a. Weekly copy across daylight-saving changes is fixed here (closes C-6); the server side of C-2 is fixed here as well.

### PR 2a - Calendars in the masseur's timezone

Added on 2026-11-16 while grooming PR 2: no pull request covered point 2 of [BR-006](decisions.md#br-006) (clients see times in the masseur's timezone with a label).

**Scope:** the masseur availability calendar, the client booking calendar and the client sessions calendar render days, hours, week ranges and "today" in the masseur's timezone (FullCalendar with `@fullcalendar/luxon3`) instead of the browser's; the timezone label from PR 2 is shown; the masseur's grid of 05:00-23:00 matches the server rule.

**Acceptance criteria:**
- With the browser set to another timezone, every calendar shows the same local hours as the masseur's timezone, and the label states it.
- The masseur calendar's working-hour grid and the server's check agree across daylight-saving changes.
- Closes C-2.

**Groomed (2026-11-16):** sessions calendar stays in the browser zone with a per-event masseur label; one line "Times in {label}" / "Час: {label}" above the masseur and client booking calendars; no device-vs-profile warning until PR 8; `timezone` comes from the existing availability and bookings responses.

### PR 3 - Availability rules

**Scope:** the working window is enforced on every write path (manual changes, the weekly copy including a supplied template, and the masseur's walk-in booking); the server rejects availability changes for slots that have started. (Weekly copy across daylight-saving changes was done in PR 2.)

**Acceptance criteria:**
- A slot outside 05:00-23:00 in the masseur's timezone cannot be created by any path and the error is the same and clear.
- Adding or removing a started slot is rejected by the server.
- Closes C-3, C-4.

**Groomed (2026-11-16):** `out_of_hours` / `slot_in_past`; existing out-of-window rows left untouched.

### PR 4 - Booking lead time, 120-day window, cancellation cutoff

**Status:** merged ([#8](https://github.com/dmytro-koliasa/massagego/pull/8), 2026-11-16).

**Groomed decisions:** weekly copy max = **17**; raising lead above cutoff **auto-raises cutoff** with message; 120-day copy as in BR-003; auto-raise copy as groomed; beyond-window slots are **dimmed** with "Not yet visible to clients" / "Ще не видно клієнтам" in slot details; API codes `BOOKING_LEAD_TIME`, `BOOKING_WINDOW_EXCEEDED`, `CUTOFF_TOO_LOW`; changing settings does **not** alter existing bookings (cutoff enforcement on cancel stays PR 5).

**Scope:** masseur settings for the client booking lead time (1, 2, 3 or 4 hours, default 1) and the client cancellation cutoff (1, 2, 3, 4, 6, 8, 12, 24, 36, 48 or 72 hours, default 24, never below the lead time), with the settings screen; the client availability endpoint hides slots inside the lead time and beyond 120 days (date-based, masseur timezone); the booking route enforces both with a strict boundary; the 60-minute grace for started slots is removed; weekly copy is limited to 17 weeks; the masseur calendar marks slots beyond the window as "not yet visible to clients"; the client calendar disables forward navigation on the last week of the window with the message.

**Acceptance criteria:**
- With a lead time of 1 hour, a 10:00 slot is visible and bookable at 08:59:59 and hidden and rejected at 09:00:00.
- A client cannot book or see a slot beyond the end of the day `today + 120 days` in the masseur's timezone; the masseur can still create slots and walk-ins beyond it.
- The cutoff cannot be saved below the lead time; changing the lead time above the cutoff raises the cutoff, with a message.
- The message "Booking is available up to 120 days ahead — until {date}" appears in both languages.
- Closes C-1.

### PR 5 - Client booking and cancellation rules

**Status:** merged ([#9](https://github.com/dmytro-koliasa/massagego/pull/9), 2026-11-16).

**Groomed decisions:** client overlap also guarded by exclusion constraint `Booking_no_overlapping_active_client_slots` (walk-ins excluded); error codes `CLIENT_SLOT_OVERLAP`, `CLIENT_BOOKING_LIMIT`, `CANCEL_CUTOFF_PASSED`, `CANCEL_REASON_REQUIRED`, `CLIENT_PROFILE_INCOMPLETE`; post-cutoff and X-1 messages with/without phone + `tel:`-ready copy; pre-book notice when a selected slot is already inside cutoff; cancel reason labels as groomed; copy `User.name` + `User.phone` only (else refuse).

**Scope:** a client cannot hold two active bookings for the same hour; at most 30 active future bookings; a client booking takes name and phone from the account and ignores the request fields; the client cancellation requires a reason from the list ("Other" needs a text up to 200 characters, other reasons have no text field); the cutoff is checked on cancellation; cancelling one's own already cancelled booking succeeds and a missing or foreign booking returns the same 404; after the cutoff the client sees the message and the masseur's phone; the message when only one of two consecutive Thai slots can still be cancelled.

**Acceptance criteria:**
- Two simultaneous requests for the same client and hour: exactly one succeeds (a concurrency test, like the existing masseur one).
- The 31st active future booking is refused as a whole, also for a multi-slot request.
- Fields `clientName` and `clientPhone` sent by a client are ignored.
- A cancellation without a reason, with "Other" without text, or with text for another reason is refused.
- Cancellation after the cutoff is refused with the masseur's phone shown (or a message when the phone is not yet set).
- A repeated cancel returns success; a foreign or missing booking returns 404 for both.
- Closes C-5, C-7; implements X-1.

### PR 6 - Thai massage hints

**Status:** merged ([#10](https://github.com/dmytro-koliasa/massagego/pull/10), 2026-11-17).

**Groomed decisions:** suppress slot-selection toast when ≥2 consecutive hours are already selected (type-change toast always); consecutive = same masseur/client/Thai type, ±1 h, no one-click neighbour cancel; shared booking hint + cancel-neighbour wording as groomed; client-only (not masseur walk-in/cancel).

**Scope:** persistent toasts (closed only by the user): a recommendation to choose more than one consecutive slot when the type becomes Thai and after selecting a slot while Thai is chosen; on cancellation of one of consecutive slots, a recommendation to cancel the neighbour, or the message that the neighbour can no longer be cancelled.

**Acceptance criteria:** each trigger shows the toast, the toast does not close by itself, texts exist in both languages, and nothing blocks a booking or cancellation.

### PR 7 - Shared excluded-country list

**Status:** merged ([#11](https://github.com/dmytro-koliasa/massagego/pull/11), 2026-11-17).

**Groomed decisions:** UN M49 Africa (+ dependent territories, Egypt) + `RU` + `BY`; +7 via libphonenumber (`KZ` ok, `RU` reject); phone copy `This country code is not supported.` / `Цей код країни не підтримується.`; city empty `No cities found.` / `Міст не знайдено.`; no legacy data migration.

**Scope:** one list of excluded country codes (all African countries, Russia, Belarus) used by phone validation and the city search; any other valid international number is accepted; the phone picker offers the allowed countries (Ukraine default); the city search and the catalog city filter hide the excluded countries.

**Acceptance criteria:**
- A number from an excluded country is rejected by registration, login, the masseur profile and walk-in bookings with the same message.
- Kazakhstan numbers (dialling code +7) are accepted and Russian ones rejected.
- Cities of excluded countries are not offered in the search and are not shown as filter values.
- The list is defined once.

### PR 8 - Registration and profile fields

**Status:** merged ([#12](https://github.com/dmytro-koliasa/massagego/pull/12), 2026-11-17).

**Groomed decisions:** canonical city = Nominatim `placeId` + `countryCode` + EN/UK names (legacy `city` kept, no backfill); email verify = one-time link, TTL 24h, resend 60s / max 5 per hour, log adapter until P-3; single-screen client register; `preferredLocale` stored and syncs UI; masseur phone required + public notice; timezone editable with geo-tz suggestion from city + device mismatch warning; incomplete clients: banner, browse ok, booking blocked; empty city list = message + show all.

**Scope:** at client registration, a required city (canonical form) and a required real email, with verification by a link or a code; the preferred language stored in the account (set at registration, editable); the masseur phone becomes required and public with a notice on the form; the masseur timezone field is editable in the profile (from PR 2; whether to propose it from the city, finding X-2, is groomed here); existing clients without a city or email are asked to complete them without blocking sign-in.

**Acceptance criteria:**
- A client cannot finish registration without a city and an email; email notifications are not sent to an unverified address.
- The same city is stored once regardless of the interface language used when choosing it.
- A masseur profile cannot be saved without a phone; the notice that the phone is public is shown.

### PR 9 - Password reset and rate limits

**Status:** merged ([#13](https://github.com/dmytro-koliasa/massagego/pull/13), 2026-11-17).

**Groomed decisions:**
- Reset link TTL **1 hour**, one-time; a new request invalidates the previous token (`VerificationToken` with identifier `password-reset:${userId}`).
- After a successful reset: delete all `Session` rows for that `userId` (force re-login).
- Rate limits (sliding window) in **PostgreSQL** (`RateLimitBucket`): sign-in 10/15 min per IP and per account; registration 5/hour per IP; password-reset request 5/hour per IP and per identifier; booking create/cancel 30/15 min per IP and per account.
- On limit: HTTP 429 with EN/UK “Too many attempts…” messages; reset request always returns the same success body; email only if `passwordHash` + `emailVerified` (Google-only / unverified → no email, same response).
- Client lookup by phone; masseur by email; reuse `sendEmail` (log adapter until P-3).

**Scope:** a one-time, time-limited reset link sent to the verified email (the request answers the same way whether or not the account exists); basic rate limits per IP and per account on sign-in, registration, reset and booking operations.

**Acceptance criteria:** a reset link works once and expires; a masseur who signs in only with Google is not offered a reset; repeated sign-in failures are blocked for a while with a clear message; limits do not block normal use; the counters work across serverless instances (prerequisite P-5).

### PR 10 - Image upload checks

**Status:** merged ([#14](https://github.com/dmytro-koliasa/massagego/pull/14), 2026-11-17); client geo-tz/`fs` follow-up [#15](https://github.com/dmytro-koliasa/massagego/pull/15).

**Groomed decisions:**
- Library: **sharp** (already a dependency).
- Input: **JPEG, PNG, WebP only** (reject GIF and others by real content). Output: **JPEG quality ~85**, except **PNG with alpha → PNG**. Strip all metadata.
- Max long side **2000px**, never upscale, keep aspect ratio. Keep **5 MB** input limit and **3** gallery images.
- Same pipeline for gallery and avatars (masseur + client profile photos).
- `GalleryImage.width` / `height` come from the server process result, not the client.

**Scope:** uploaded images are checked by their real content, measured by the server, and re-saved without metadata (such as GPS); the size and count limits stay.

**Acceptance criteria:** a file with a wrong declared type or non-image content is refused; the stored image has no metadata; the dimensions come from the server.

### PR 11 - Masseur catalog

**Status:** merged ([#16](https://github.com/dmytro-koliasa/massagego/pull/16), 2026-11-17).

**Groomed decisions:**
- Listed only if complete profile (`nameEn` or `nameUk`, `cityPlaceId`, `address`, `phone` non-empty) **and** at least one `AvailabilitySlot` row ever; legacy `city` alone is not enough.
- Nearest free time within `CLIENT_BOOKING_WINDOW_DAYS` (120) end-of-day in masseur TZ, outside lead hours; green/red plaque text always present (EN/UK); TZ via `formatTimeZoneOffsetLabel`.
- Order: free time first, then `createdAt` DESC; city filter, pagination totals and city options count **only listed** masseurs.
- Unlisted profile opens by direct link with "not ready" message; booking UI and create/availability APIs refuse.
- Remove masseur email from `GET /api/masseurs` (closes C-9). Empty-city CTA from PR 8 kept.

**Scope:** list a masseur only if the profile is complete (name, city, address, phone) and at least one availability record exists; a card label (green with the nearest free time, red "No free time"; free time means a future, unbooked slot outside the masseur's lead time and within 120 days); masseurs with free time first, then the others, newest first; the list defaults to the client's city with a switch to another city or all cities; a profile that is not listed opens but cannot be booked ("profile is not ready yet"); the masseur email is removed from the list response.

**Acceptance criteria:** each rule has a test; the label always contains text; the nearest free time is shown in the masseur's timezone with the label; the response no longer contains the email. Closes C-9.

### PR 12 - Email notifications

**Status:** merged ([#17](https://github.com/dmytro-koliasa/massagego/pull/17), 2026-11-17).

**Groomed decisions:**
- Provider: **Resend** (`EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`); local default remains `log`.
- Retries: **Vercel Cron** every **5 minutes** → `/api/cron/notifications` with `Authorization: Bearer CRON_SECRET`; Postgres `NotificationOutbox`; backoff **1 → 5 → 15 → 30** minutes; max age **24 h** then `dead`.
- Settings: separate **Notifications** page (client + masseur); **email toggles only** in this PR (Telegram column in PR 13).
- Until Telegram: email for critical events (2–4 + confirmation 5) **cannot be turned off**; event 1 (new booking → masseur) may be off.
- Copy: short transactional subject + 3–5 lines plain + simple HTML; no phones; masseur TZ label; `preferredLocale`.
- Delivery: **always create an outbox row**, then attempt send immediately; cron retries `pending`/`failed` (and reclaim expired `processing` leases — #80). Semantics are **at-least-once**: a lease expiry mid-send can still duplicate at the provider; claim/lease prevents two live workers from starting the same row.
- Event 4: type + template + settings + `enqueueClientDeletedCancellationNotice` exported; **enqueue call site in PR 14**.

**Scope:** sending by email for the five events (new booking, client cancellation with the reason, masseur cancellation, automatic cancellation on client deletion, booking confirmation), in the recipient's language, with times in the masseur's timezone and no phone numbers; per-event, per-channel settings with at least one channel kept on for cancellations and confirmations; a send log and automatic retries for up to a day; the events stay visible in the application as long as the booking exists.

**Acceptance criteria:** each event sends one message to the right person; a failed send is retried and logged; a user cannot switch off the last channel of a critical event; a message is sent only to a verified address; nothing is sent for a masseur walk-in booking.

### PR 13 - Telegram and phone confirmation

**Status:** merged ([#18](https://github.com/dmytro-koliasa/massagego/pull/18), 2026-11-17).

**Groomed decisions:**
- One bot (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`); webhook `POST /api/telegram/webhook`.
- Deep link + one-time `VerificationToken` (`telegram-link:${userId}`), TTL **15 min**, new token invalidates previous.
- Client and masseur are separate `User` rows; one Telegram chat may link both when **email or phone** matches; otherwise refuse.
- Notifications to every linked User; **phone confirmed** only on the portal that requested share-contact.
- Masseurs may confirm phone; masseur mark UI deferred; client mark in slot details: ✓ + Confirmed/Підтверджено.
- Mismatch → refuse + hint to update phone in the app.
- Disconnect in app (current User) and bot `/disconnect` (all Users with that chat); clears chat + phone confirmed.
- Notifications UI: Telegram column; critical events need ≥1 channel; email unlocks when Telegram is connected and on.
- Bot + Telegram event copy uses `preferredLocale`; share-contact prompt after connect and again from the app.
- Full `/privacy` and `/terms` (EN/UK) with links at Connect and footer/register.

**Scope:** connecting Telegram through the bot (a link from the application), the same events sent through Telegram when connected, disconnecting; the optional phone confirmation through the bot (the contact must belong to the same Telegram account and match the phone in the application) and the "phone confirmed" mark shown to the masseur.

**Acceptance criteria:** a user receives the events in Telegram only after connecting and consenting; a shared contact that is not the user's own, or does not match the account number, is refused; the mark appears only after a successful match; the settings from PR 12 control the Telegram channel.

### PR 14 - Account deletion and data cleanup

**Status:** merged ([#19](https://github.com/dmytro-koliasa/massagego/pull/19), 2026-11-17).

**Groomed decisions:**
- Cron `GET /api/cron/cleanup` daily `0 3 * * *` UTC with `CRON_SECRET`.
- `Booking.hasRetentionHold` default false (no UI); job skips `true`.
- History hint EN/UK on client My sessions only.
- Delete in profile via custom `ConfirmDialog` (no `window.confirm` / type-DELETE).
- Remaining bookings store `clientName=deleted_user`; UI localises the label.
- `User.deletedAt` + `deleted:{id}@invalid.local`; clear PII, sessions, Telegram, prefs/outbox, uploads.
- Client delete cancels future bookings + event 4 notify; masseur blocked with `{n}` + calendar link.
- Privacy updated; hosting backup scrub deferred to P-2.

**Scope:** self-service account deletion with anonymisation; a client's future bookings are cancelled automatically (reason "client account deleted") and the masseur is notified; a masseur with future bookings cannot delete the account; a scheduled job physically deletes cancelled bookings 7 days after `cancelledAt` and completed bookings 3 months after the session start, never touching bookings with financial or legal obligations; the hint "Past sessions older than 3 months are removed." on the client sessions list and masseur availability calendar.

**Acceptance criteria:** a booking cancelled more than 7 days ago no longer exists and is returned nowhere; a booking cancelled less than 7 days ago is unchanged; a completed booking older than 3 months is deleted; a deleted client's name and phone are gone from the remaining bookings; the job is idempotent and logs failures; a masseur deletion with future bookings is refused with a clear message.

### PR 15 - Administration panel

**Status:** merged ([#20](https://github.com/dmytro-koliasa/massagego/pull/20), 2026-11-17).

**Groomed decisions:**
- Separate portal `admin`; header nav link; not on the home hero.
- Bootstrap one admin from `ADMIN_BOOTSTRAP_EMAIL` + `ADMIN_BOOTSTRAP_PASSWORD` (no verify / 2FA).
- Complaints deferred entirely (no stub UI).
- Block → logout / no login; future bookings remain; no new bookings to/from blocked users; catalog hides blocked masseurs.
- Admin sees full profile read-only; block only client/masseur; filters Active / Blocked / Deleted.
- `User.blockedAt` + `AdminAuditLog` + `/admin/audit` UI.
- Excluded countries stay in code ([BR-013](decisions.md#br-013)).
- Blocked sign-in message: account blocked + contact support.

**Scope:** a minimal panel for an administrator: the list of users, blocking and unblocking; a protected administrator sign-in; an audit log of administrator actions. Complaints are out of scope for this PR.

**Acceptance criteria:** only an administrator can open the panel; a blocked user cannot sign in or be booked; every administrator action is logged; the data an administrator can see is limited to what is needed for moderation.

### Follow-up — In-app notification list (BR-009)

**Status:** merged ([#62](https://github.com/dmytro-koliasa/massagego/pull/62), 2026-11-18).

**Groomed decisions** (see [BR-009](decisions.md#br-009) decision 12):
- Client + masseur only; events **1–6** (same as email/Telegram, including `booking_reminder`).
- New inbox table (not `NotificationOutbox`); write rows at the same enqueue points as external delivery.
- `/client|/masseur/notifications`: feed above prefs; read on item click + mark-all; deep links to booking/session; nav badge with capped unread count; poll badge ~30–60 s.
- Retention ~**30 days** via cleanup cron; no in-app channel prefs; no phones in copy; no web push / SSE / admin feed / new event types.

**Scope:** durable in-app inbox + list UI + badge for client and masseur, wired to existing notification events.

**Acceptance criteria:**
- Creating/cancelling/confirming/reminding a booking creates the matching inbox row for the recipient(s).
- Unread badge reflects unread count; mark-all and click-to-open clear unread as specified.
- Deep link opens the related portal page; walk-ins still create no client-facing notice.
- Rows older than ~30 days are removed by cleanup; texts EN/UK without phone numbers.

### Follow-up — Dual portal session hint (`requirePortalUser`)

**Status:** groomed 2026-11-18; **merged** ([#69](https://github.com/dmytro-koliasa/massagego/pull/69)).

**Groomed decisions:**
- Shared APIs keep one path; UI always sends `X-Portal: client|masseur`.
- One session resolves without the header; both sessions without a valid hint → `409 ambiguous_portal`; hint without matching session → `401`.
- Covers inbox, prefs, Telegram link/disconnect/confirm-phone, account delete.

**Scope:** disambiguate dual client+masseur cookies for shared portal APIs without splitting routes.

**Acceptance criteria:**
- With both cookies and `X-Portal: masseur`, masseur inbox/prefs/delete act as the masseur user (not the client).
- Without a hint and with both cookies, APIs return `409 ambiguous_portal`.
- Unit tests cover single session, hinted dual session, ambiguous dual session, and missing hinted session.

**E2E (local, suite `inboxDual`, [#71](https://github.com/dmytro-koliasa/massagego/pull/71)):** one browser context keeps client + masseur cookies → client books → masseur inbox badge/row works (UI sends `X-Portal`); bare `fetch('/api/notifications/inbox')` without the header returns `409 ambiguous_portal` (`e2e/masseur-inbox-dual-session.spec.ts`).

### Follow-up — Masseur bulk-cancel future bookings (X-4 / BR-011)

**Status:** groomed 2026-11-18; **merged** ([#63](https://github.com/dmytro-koliasa/massagego/pull/63)).

**Groomed decisions** (see [BR-011](decisions.md#br-011) / X-4):
- General tool near the masseur calendar **and** CTA from the delete-account blocked banner.
- Cancel **all** future non-started `confirmed` bookings (including walk-ins) in one confirm; no multi-select in v1.
- One batch availability choice: `available` | `unavailable` (same as single resolve).
- Per client booking: event 3 + in-app inbox; walk-ins notify nobody.
- One DB transaction for cancels + availability; notifications best-effort after; rate-limit the endpoint.
- Confirm dialog shows count + availability; EN/UK.

**Scope:** masseur bulk-cancel of all future bookings so account deletion (and calendar cleanup) does not require N manual resolves.

**Acceptance criteria:**
- After a successful bulk-cancel, no future non-started confirmed bookings remain for that masseur; availability matches the chosen mode.
- Clients with accounts receive event-3 notifications (email/Telegram prefs + inbox); walk-ins do not.
- Empty set is refused clearly; rate limit returns a clear error; texts EN/UK.
- Delete-account blocked banner offers the same flow; single-slot resolve unchanged.

### Follow-up — Recent cancellations → calendar deep-link (AR-24 / BR-004)

**Status:** groomed 2026-11-18; **merged** ([#64](https://github.com/dmytro-koliasa/massagego/pull/64)).

**Groomed decisions** (see [BR-004](decisions.md#br-004)):
- List rows link to `/masseur/dashboard?slot=<ISO>` (cancellation `slotStart`), not hash (hash kept for `#bulk-cancel`).
- Calendar: `gotoDate` to that week; open slot details when the hour exists.
- Missing/unavailable slot: still jump to the week + toast; no details modal.
- Brief ~2–3 s pulse/highlight on the target cell when found.
- Strip `slot` from the URL after consume so refresh does not re-open.

**Scope:** deep-link from Recent cancellations into the existing masseur week calendar (no new API).

**Acceptance criteria:**
- Clicking a recent-cancellation row lands on the matching week; details open when the slot is present.
- Missing slot shows toast and the week still; no bogus modal.
- Pulse is temporary; `?slot=` is removed after handling; EN/UK toast copy.
- `#bulk-cancel` behaviour unchanged.

### Follow-up — Playwright E2E for #62–#64 (local)

**Status:** groomed 2026-11-18; **merged** ([#65](https://github.com/dmytro-koliasa/massagego/pull/65), [#66](https://github.com/dmytro-koliasa/massagego/pull/66), [#67](https://github.com/dmytro-koliasa/massagego/pull/67)).

**Groomed decisions (series):**
- Three sequential PRs (same cadence as [#34](https://github.com/dmytro-koliasa/massagego/pull/34)–[#60](https://github.com/dmytro-koliasa/massagego/pull/60)), not one mega-spec.
- **PR 1 — in-app inbox:** ([#65](https://github.com/dmytro-koliasa/massagego/pull/65)).
- **PR 2 — bulk-cancel (X-4):** ([#66](https://github.com/dmytro-koliasa/massagego/pull/66)).
- **PR 3 — Recent cancellations → `?slot=`:** ([#67](https://github.com/dmytro-koliasa/massagego/pull/67)) seed cancelled client booking + available slot on same `slotStart` (suite `slotDeepLink`) → masseur clicks Recent cancellations row → slot details dialog open + URL without `slot`.
- **Follow-up E2E — missing-slot + pulse:** ([#73](https://github.com/dmytro-koliasa/massagego/pull/73)) suites `slotDeepLinkMissing` / `slotDeepLinkPulse`; raw `goto ?slot=` without the list still out of scope.

**Scope (PR 3):** one Playwright happy-path for AR-24 list deep-link; update [testing.md](../testing.md).

**Acceptance criteria (PR 3):**
- Spec passes locally with `npm run test:e2e` against suite `slotDeepLink`.
- Clicking the list row opens the calendar slot dialog; after consume, URL is `/masseur/dashboard` without `slot`.
- Missing-slot toast (no dialog) and pulse CSS covered by follow-up suites above.

## 5. Risks and notes

- **Production state is unknown** (P-1). Until it is checked, nothing here should be deployed to real data.
- **Legal review is a release prerequisite** (P-2): the decisions are product decisions, not legal opinions.
- **Hard deletion is irreversible:** a wrongly cancelled booking cannot be restored after 7 days, and history older than 3 months is gone ([BR-011](decisions.md#br-011), [BR-018](decisions.md#br-018)).
- **Dependencies on providers:** email, Telegram and the hosting scheduler were designed into plan PRs 9/12/13/14 ([#13](https://github.com/dmytro-koliasa/massagego/pull/13), [#17](https://github.com/dmytro-koliasa/massagego/pull/17)–[#19](https://github.com/dmytro-koliasa/massagego/pull/19)); remaining production cost/limits for Resend domain (P-3) and Telegram webhook host (P-4) are not yet known.
- **Deferred items stay out of scope:** prices ([BR-012](decisions.md#br-012)), late-cancellation fee and payment ([BR-015](decisions.md#br-015)), courses ([BR-016](decisions.md#br-016)). When payments arrive, the obligation flag and the separate payment records must be designed (see [BR-011](decisions.md#br-011) and [BR-018](decisions.md#br-018)).
- **Notes carried from the review:** X-2 (timezone from the city), X-3 (long registration form), X-4 (masseur bulk-cancel — [#63](https://github.com/dmytro-koliasa/massagego/pull/63)).
