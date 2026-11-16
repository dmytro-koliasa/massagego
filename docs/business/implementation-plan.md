# Implementation Plan

> **Status:** plan created 2026-11-16 from the **Approved** decisions in [decisions.md](decisions.md) and the changes listed in [data-model-changes.md](data-model-changes.md). **Nothing is implemented.** This is track 2 of the workflow: each pull request below is **groomed with the product owner before any code is written**, and the order or scope may change.
> The current database holds test data only and will be wiped; schema migrations are still required.

## 1. How the work is organised

- **Slicing:** by theme, 15 pull requests, ordered by dependencies (owner's choice, 2026-11-16).
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
| P-1 | Verify the production database: the migration `20261115120000_booking_no_overlap` (needs the `btree_gist` extension), overlapping active bookings, and the production server timezone. Not verified today. | the first deployment to production |
| P-2 | Legal review under XR-1: retention periods (7 days, 3 months), the excluded-country list, the public masseur phone, consent texts, the privacy policy. | the first release to real users |
| P-3 | Choose the email provider and set up sending (domain, sender, templates). | PR 8 (verification), PR 9, PR 12 |
| P-4 | Create the Telegram bot and decide how its token is stored. | PR 13 |
| P-5 | Decide where scheduled jobs run on the hosting platform and where the rate-limit counters are stored (an in-memory counter does not work across serverless instances). | PR 9, PR 12, PR 14 |
| P-6 | Decide how the shared test database is provided in continuous integration (there is no CI today). | PR 1 onwards (recommended) |

## 3. Order and dependencies

| № | Pull request | Decisions | Depends on |
|---|---|---|---|
| 1 | Booking statuses and cancellation data | BR-005, C-8 | none |
| 2 | Masseur timezone and shared constants | BR-006, BR-001 | none |
| 3 | Availability rules | BR-007, C-2, C-3, C-4, C-6 | 2 |
| 4 | Booking lead time, 120-day window, cancellation cutoff | BR-002, BR-003, BR-004, C-1 | 1, 2 |
| 5 | Client booking and cancellation rules | BR-008, BR-004, C-5, C-7, X-1 | 1, 4 |
| 6 | Thai massage hints | BR-014 | 5 |
| 7 | Shared excluded-country list | BR-013 | none |
| 8 | Registration and profile fields | BR-017, BR-009 (fields), BR-004 (phone) | 7 |
| 9 | Password reset and rate limits | BR-019, BR-020 | 8 |
| 10 | Image upload checks | BR-022 | none |
| 11 | Masseur catalog | BR-010, BR-017, C-9 | 2, 4, 8 |
| 12 | Email notifications | BR-009 | 1, 2, 8 |
| 13 | Telegram and phone confirmation | BR-009, BR-023 | 12 |
| 14 | Account deletion and data cleanup | BR-011, BR-018 | 1, 12 |
| 15 | Administration panel | BR-021 | 14 |

PRs 1, 2, 7 and 10 have no dependencies and can start in any order or in parallel.

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

**To groom first:** the default timezone for a masseur and how it is chosen (proposal: derive it from the city and let the masseur confirm, finding X-2); the label format; where the field is edited.

### PR 3 - Availability rules

**Scope:** the working window is enforced on every write path (manual changes, the weekly copy including a supplied template, and the masseur's walk-in booking); the server rejects availability changes for slots that have started; weekly copy keeps the same local clock time across daylight-saving changes.

**Acceptance criteria:**
- A slot outside 05:00-23:00 in the masseur's timezone cannot be created by any path and the error is the same and clear.
- Adding or removing a started slot is rejected by the server.
- A week copied across a daylight-saving change keeps the same local hours.
- Closes C-2, C-3, C-4, C-6.

**To groom first:** the error codes; the treatment of existing slots outside the window (none expected, the data is test data).

### PR 4 - Booking lead time, 120-day window, cancellation cutoff

**Scope:** masseur settings for the client booking lead time (1, 2, 3 or 4 hours, default 1) and the client cancellation cutoff (1, 2, 3, 4, 6, 8, 12, 24, 36, 48 or 72 hours, default 24, never below the lead time), with the settings screen; the client availability endpoint hides slots inside the lead time and beyond 120 days (date-based, masseur timezone); the booking route enforces both with a strict boundary; the 60-minute grace for started slots is removed; weekly copy is limited to about 17 weeks; the masseur calendar marks slots beyond the window as "not yet visible to clients"; the client calendar disables forward navigation on the last week of the window with the message.

**Acceptance criteria:**
- With a lead time of 1 hour, a 10:00 slot is visible and bookable at 08:59:59 and hidden and rejected at 09:00:00.
- A client cannot book or see a slot beyond the end of the day `today + 120 days` in the masseur's timezone; the masseur can still create slots and walk-ins beyond it.
- The cutoff cannot be saved below the lead time; changing the lead time above the cutoff is refused or the cutoff is raised, with a message.
- The message "Booking is available up to 120 days ahead - until {date}" appears in both languages.
- Closes C-1.

**To groom first:** the exact weekly-copy limit; how the cutoff and lead time interact when one is changed; wording of the messages; whether the masseur's existing bookings are affected by a new setting (they are not).

### PR 5 - Client booking and cancellation rules

**Scope:** a client cannot hold two active bookings for the same hour; at most 30 active future bookings; a client booking takes name and phone from the account and ignores the request fields; the client cancellation requires a reason from the list ("Other" needs a text up to 200 characters, other reasons have no text field); the cutoff is checked on cancellation; cancelling one's own already cancelled booking succeeds and a missing or foreign booking returns the same 404; after the cutoff the client sees the message and the masseur's phone; the message when only one of two consecutive Thai slots can still be cancelled.

**Acceptance criteria:**
- Two simultaneous requests for the same client and hour: exactly one succeeds (a concurrency test, like the existing masseur one).
- The 31st active future booking is refused as a whole, also for a multi-slot request.
- Fields `clientName` and `clientPhone` sent by a client are ignored.
- A cancellation without a reason, with "Other" without text, or with text for another reason is refused.
- Cancellation after the cutoff is refused with the masseur's phone shown (or a message when the phone is not yet set).
- A repeated cancel returns success; a foreign or missing booking returns 404 for both.
- Closes C-5, C-7; implements X-1.

**To groom first:** whether the client overlap is also guarded by a database constraint (as for the masseur); error codes; the masseur phone is required only in PR 8, so the message must work without it until then.

### PR 6 - Thai massage hints

**Scope:** persistent toasts (closed only by the user): a recommendation to choose more than one consecutive slot when the type becomes Thai and after selecting a slot while Thai is chosen; on cancellation of one of consecutive slots, a recommendation to cancel the neighbour, or the message that the neighbour can no longer be cancelled.

**Acceptance criteria:** each trigger shows the toast, the toast does not close by itself, texts exist in both languages, and nothing blocks a booking or cancellation.

**To groom first:** whether the toast is suppressed when two or more consecutive slots are already selected; how "consecutive" is detected on cancellation; the wording.

### PR 7 - Shared excluded-country list

**Scope:** one list of excluded country codes (all African countries, Russia, Belarus) used by phone validation and the city search; any other valid international number is accepted; the phone picker offers the allowed countries (Ukraine default); the city search and the catalog city filter hide the excluded countries.

**Acceptance criteria:**
- A number from an excluded country is rejected by registration, login, the masseur profile and walk-in bookings with the same message.
- Kazakhstan numbers (dialling code +7) are accepted and Russian ones rejected.
- Cities of excluded countries are not offered in the search and are not shown as filter values.
- The list is defined once.

**To groom first:** the exact list of countries and territories; the error messages.

### PR 8 - Registration and profile fields

**Scope:** at client registration, a required city (canonical form) and a required real email, with verification by a link or a code; the preferred language stored in the account (set at registration, editable); the masseur phone becomes required and public with a notice on the form; the masseur timezone field is editable in the profile (from PR 2); existing clients without a city or email are asked to complete them without blocking sign-in.

**Acceptance criteria:**
- A client cannot finish registration without a city and an email; email notifications are not sent to an unverified address.
- The same city is stored once regardless of the interface language used when choosing it.
- A masseur profile cannot be saved without a phone; the notice that the phone is public is shown.

**To groom first:** the canonical city representation and how existing masseur cities are reconciled; the verification flow and its limits; the form layout (finding X-3).

### PR 9 - Password reset and rate limits

**Scope:** a one-time, time-limited reset link sent to the verified email (the request answers the same way whether or not the account exists); basic rate limits per IP and per account on sign-in, registration, reset and booking operations.

**Acceptance criteria:** a reset link works once and expires; a masseur who signs in only with Google is not offered a reset; repeated sign-in failures are blocked for a while with a clear message; limits do not block normal use; the counters work across serverless instances (prerequisite P-5).

**To groom first:** link lifetime, the exact limits and intervals, the effect on open sessions after a reset.

### PR 10 - Image upload checks

**Scope:** uploaded images are checked by their real content, measured by the server, and re-saved without metadata (such as GPS); the size and count limits stay.

**Acceptance criteria:** a file with a wrong declared type or non-image content is refused; the stored image has no metadata; the dimensions come from the server.

**To groom first:** the library; the allowed formats; the maximum dimensions; whether avatars use the same pipeline.

### PR 11 - Masseur catalog

**Scope:** list a masseur only if the profile is complete (name, city, address, phone) and at least one availability record exists; a card label (green with the nearest free time, red "No free time"; free time means a future, unbooked slot outside the masseur's lead time and within 120 days); masseurs with free time first, then the others, newest first; the list defaults to the client's city with a switch to another city or all cities; a profile that is not listed opens but cannot be booked ("profile is not ready yet"); the masseur email is removed from the list response.

**Acceptance criteria:** each rule has a test; the label always contains text; the nearest free time is shown in the masseur's timezone with the label; the response no longer contains the email. Closes C-9.

**To groom first:** the exact "complete profile" check; how the label and the order are computed efficiently for a page; the message when the client's city has no masseurs.

### PR 12 - Email notifications

**Scope:** sending by email for the five events (new booking, client cancellation with the reason, masseur cancellation, automatic cancellation on client deletion, booking confirmation), in the recipient's language, with times in the masseur's timezone and no phone numbers; per-event, per-channel settings with at least one channel kept on for cancellations and confirmations; a send log and automatic retries for up to a day; the events stay visible in the application as long as the booking exists.

**Acceptance criteria:** each event sends one message to the right person; a failed send is retried and logged; a user cannot switch off the last channel of a critical event; a message is sent only to a verified address; nothing is sent for a masseur walk-in booking.

**To groom first:** the provider and the background mechanism (prerequisites P-3, P-5); the texts; the settings screen.

### PR 13 - Telegram and phone confirmation

**Scope:** connecting Telegram through the bot (a link from the application), the same events sent through Telegram when connected, disconnecting; the optional phone confirmation through the bot (the contact must belong to the same Telegram account and match the phone in the application) and the "phone confirmed" mark shown to the masseur.

**Acceptance criteria:** a user receives the events in Telegram only after connecting and consenting; a shared contact that is not the user's own, or does not match the account number, is refused; the mark appears only after a successful match; the settings from PR 12 control the Telegram channel.

**To groom first:** the bot flow and texts; what the user sees on a mismatch; whether masseurs can confirm their phone too.

### PR 14 - Account deletion and data cleanup

**Scope:** self-service account deletion with anonymisation; a client's future bookings are cancelled automatically (reason "client account deleted") and the masseur is notified; a masseur with future bookings cannot delete the account; a scheduled job physically deletes cancelled bookings 7 days after `cancelledAt` and completed bookings 3 months after the session start, never touching bookings with financial or legal obligations; the hint "Sessions from the last 3 months are shown" on the history screens.

**Acceptance criteria:** a booking cancelled more than 7 days ago no longer exists and is returned nowhere; a booking cancelled less than 7 days ago is unchanged; a completed booking older than 3 months is deleted; a deleted client's name and phone are gone from the remaining bookings; the job is idempotent and logs failures; a masseur deletion with future bookings is refused with a clear message.

**To groom first:** the job's schedule (P-5); how the obligation flag will exist before payments do (a placeholder with no data); backups and logs under XR-1; the wording of the deletion and history screens.

### PR 15 - Administration panel

**Scope:** a minimal panel for an administrator: the list of users, blocking and unblocking, and complaints; a protected administrator sign-in; an audit log of administrator actions.

**Acceptance criteria:** only an administrator can open the panel; a blocked user cannot sign in or be booked; every administrator action is logged; the data an administrator can see is limited to what is needed.

**To groom first:** how an administrator is created and protected; where complaints come from (a "report" action for users is not decided and must be groomed with this item); what happens to a blocked user's future bookings; whether the excluded-country list becomes editable.

## 5. Risks and notes

- **Production state is unknown** (P-1). Until it is checked, nothing here should be deployed to real data.
- **Legal review is a release prerequisite** (P-2): the decisions are product decisions, not legal opinions.
- **Hard deletion is irreversible:** a wrongly cancelled booking cannot be restored after 7 days, and history older than 3 months is gone ([BR-011](decisions.md#br-011), [BR-018](decisions.md#br-018)).
- **Dependencies on providers:** email, Telegram and the hosting scheduler affect PRs 9, 12, 13 and 14; their cost and limits are not yet known.
- **Deferred items stay out of scope:** prices ([BR-012](decisions.md#br-012)), late-cancellation fee and payment ([BR-015](decisions.md#br-015)), courses ([BR-016](decisions.md#br-016)). When payments arrive, the obligation flag and the separate payment records must be designed (see [BR-011](decisions.md#br-011) and [BR-018](decisions.md#br-018)).
- **Notes carried from the review:** X-2 (timezone from the city), X-3 (long registration form), X-4 (a masseur cancels many bookings by hand before deleting an account).
