# Data Model and Configuration Changes

> **Status:** consolidated list of what the **Approved** decisions in [decisions.md](decisions.md) require, as of 2026-11-16. Nothing here is implemented. It is an input for the implementation plan (track 2); the exact schema and names are decided when each item is groomed for implementation.
> The current database holds test data and will be wiped (see the data note in decisions.md), but schema changes and migrations are still needed.

## 1. Changes to existing tables

### `User` (both roles unless stated)

| Change | Role | Decision |
|---|---|---|
| Timezone (IANA name, for example `Europe/Kyiv`) | masseur | [BR-006](decisions.md#br-006) |
| Client booking lead time in hours, one of 1 / 2 / 3 / 4, default 1 | masseur | [BR-002](decisions.md#br-002) |
| Client cancellation cutoff in hours, one of 1, 2, 3, 4, 6, 8, 12, 24, 36, 48, 72, default 24; not below the lead time | masseur | [BR-004](decisions.md#br-004) |
| Phone becomes required and public (validated with the country rule) | masseur | [BR-004](decisions.md#br-004), [BR-013](decisions.md#br-013) |
| Real email, required and **verified** (the current synthetic email derived from the phone is replaced) | client | [BR-009](decisions.md#br-009) |
| Email verified (the existing `emailVerified` field may be used) | both | [BR-009](decisions.md#br-009) |
| City stored in canonical form (map-service identifier plus the name in the interface language) | client (new), masseur (reconcile) | [BR-017](decisions.md#br-017) |
| Preferred language (English or Ukrainian) | both | [BR-009](decisions.md#br-009) |
| Notification settings: per event and per channel on/off, with at least one channel on for critical events | both | [BR-009](decisions.md#br-009) |
| Telegram link (chat identifier and link state) | both | [BR-009](decisions.md#br-009) |
| Marker for an anonymised (deleted) account, with personal data erased | both | [BR-011](decisions.md#br-011) |

### `Booking`

| Change | Decision |
|---|---|
| `status` restricted to a fixed set: `confirmed` (renamed from `pending`) and `cancelled` | [BR-005](decisions.md#br-005) |
| `cancelledBy` (client or masseur) and `cancelledAt` | [BR-005](decisions.md#br-005) |
| Cancellation reason from a fixed list (including the system reason "client account deleted") and the free text for "Other" (up to 200 characters) | [BR-004](decisions.md#br-004), [BR-011](decisions.md#br-011) |
| Index on status and `cancelledAt` (and on `slotStart` for completed bookings) for the cleanup job | [BR-011](decisions.md#br-011), [BR-018](decisions.md#br-018) |
| Database guard against a client holding two active bookings for the same hour (exclusion constraint on the client account, rows without a client excluded), in addition to the application check | [BR-008](decisions.md#br-008) (open sub-question) |
| Name and phone for client bookings copied from the account at booking time (no schema change; a server rule) | [BR-008](decisions.md#br-008) |
| Unused columns (`preferredDate`, `preferredTime`, `clientEmail`) and a stale schema comment | open, see C-8 |

### `AvailabilitySlot`
No schema change. Only rules change (working window in the masseur's timezone, past edits rejected, weekly copy limited to about 17 weeks).

## 2. New tables or records

| Item | Purpose | Decision |
|---|---|---|
| Notification log or outbox (event, recipient, channel, state, retry count, without unnecessary personal data) | Delivery, retries for up to a day, auditing | [BR-009](decisions.md#br-009) |
| Telegram link token | One-time token used to connect an account to the bot | [BR-009](decisions.md#br-009) |
| Email verification token (the existing `VerificationToken` table may be reused) | Confirm the email address | [BR-009](decisions.md#br-009) |
| Obligation flag on bookings and separate payment records | Keep bookings with financial or legal obligations out of automatic deletion | [BR-011](decisions.md#br-011), [BR-018](decisions.md#br-018), later with [BR-015](decisions.md#br-015) |

## 3. Configuration and constants in code

| Item | Value | Decision |
|---|---|---|
| Session length | 60 minutes | [BR-001](decisions.md#br-001) |
| Working window | 05:00-23:00 in the masseur's timezone | [BR-007](decisions.md#br-007) |
| Booking window for clients | 120 days (date-based, masseur's timezone) | [BR-003](decisions.md#br-003) |
| Weekly copy limit | about 17 weeks | [BR-003](decisions.md#br-003) |
| Active future bookings per client | 30 | [BR-008](decisions.md#br-008) |
| Cancelled booking retention | 7 days from `cancelledAt` | [BR-011](decisions.md#br-011) |
| Completed booking retention | 3 months from the session start | [BR-018](decisions.md#br-018) |
| Excluded countries | one shared list for phone and city: all African countries, Russia, Belarus | [BR-013](decisions.md#br-013) |
| Cancellation reasons list | five reasons plus the system reason | [BR-004](decisions.md#br-004) |

## 4. Background jobs

| Job | Frequency | Decision |
|---|---|---|
| Delete cancelled bookings older than 7 days (without obligations) | at least daily | [BR-011](decisions.md#br-011) |
| Delete completed bookings older than 3 months (without obligations) | at least daily | [BR-018](decisions.md#br-018) |
| Retry failed notifications for up to a day | frequent | [BR-009](decisions.md#br-009) |

## 5. Changes in behaviour only (no new data)

- Lead time check for client bookings, window check for clients, and the removal of the 60-minute grace in the client booking API ([BR-002](decisions.md#br-002), [BR-003](decisions.md#br-003)).
- Cancellation cutoff check and the mandatory reason for client cancellations ([BR-004](decisions.md#br-004)).
- Server rejection of availability changes in the past and outside the working window ([BR-007](decisions.md#br-007)).
- Masseur list: visibility rule, card label, ordering, default city, and removal of the masseur email from the response ([BR-010](decisions.md#br-010), [BR-017](decisions.md#br-017)).
- No overlapping bookings per client, limit of 30, name and phone from the account ([BR-008](decisions.md#br-008)).
- Account deletion with anonymisation, automatic cancellation for clients, refusal for masseurs with future bookings ([BR-011](decisions.md#br-011)).
- Thai massage toast hints in the booking and cancellation screens ([BR-014](decisions.md#br-014)).
- Phone and city search use the same excluded-country list ([BR-013](decisions.md#br-013)).
- Notifications on the five events ([BR-009](decisions.md#br-009)).

## 6. Order dependencies visible from the data

- The timezone ([BR-006](decisions.md#br-006)) is a prerequisite for the working window, the booking window, the card label and the notification times.
- `cancelledAt`, `cancelledBy` and the reason ([BR-005](decisions.md#br-005), [BR-004](decisions.md#br-004)) are prerequisites for the cleanup job ([BR-011](decisions.md#br-011)) and for the cancellation notice ([BR-009](decisions.md#br-009)).
- The verified client email ([BR-009](decisions.md#br-009)) is a prerequisite for email notifications and for password reset ([BR-019](decisions.md#br-019)).
- The client city ([BR-017](decisions.md#br-017)) and the shared blocklist ([BR-013](decisions.md#br-013)) are prerequisites for the default city list.
