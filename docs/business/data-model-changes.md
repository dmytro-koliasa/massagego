# Data Model and Configuration Changes

> **Status:** registry of schema, constants, and jobs required by the **Approved** decisions — refreshed 2026-11-18 after track-2 closeout (product through [#20](https://github.com/dmytro-koliasa/massagego/pull/20); follow-ups [#25](https://github.com/dmytro-koliasa/massagego/pull/25)–[#28](https://github.com/dmytro-koliasa/massagego/pull/28)). Binding behaviour: [business-rules.md](business-rules.md#approved-rules) (AR-*) and [decisions.md](decisions.md). Historical plan order: [implementation-plan.md](implementation-plan.md).
> Rows are **Implemented** unless marked **Deferred**. The local DB is still test data (wipe before real use); production constraint verify remains **P-1**.

## 1. Changes to existing tables

### `User` (both roles unless stated)

| Change | Role | Decision |
|---|---|---|
| **Implemented** ([#5](https://github.com/dmytro-koliasa/massagego/pull/5)): `timezone` (IANA, default `Europe/Kyiv`); editable in profile ([#12](https://github.com/dmytro-koliasa/massagego/pull/12)) | masseur | [BR-006](decisions.md#br-006) |
| **Implemented** ([#8](https://github.com/dmytro-koliasa/massagego/pull/8)): `bookingLeadHours` (1 / 2 / 3 / 4, default 1) | masseur | [BR-002](decisions.md#br-002) |
| **Implemented** ([#8](https://github.com/dmytro-koliasa/massagego/pull/8)): `cancelCutoffHours` (1–72 options, default 24; never below lead; raising lead auto-raises cutoff) | masseur | [BR-004](decisions.md#br-004) |
| **Implemented** ([#12](https://github.com/dmytro-koliasa/massagego/pull/12)): phone required and public for masseurs (country blocklist) | masseur | [BR-004](decisions.md#br-004), [BR-013](decisions.md#br-013) |
| **Implemented** ([#12](https://github.com/dmytro-koliasa/massagego/pull/12)): real email required; `emailVerified` used for verification | both | [BR-009](decisions.md#br-009) |
| **Implemented** ([#12](https://github.com/dmytro-koliasa/massagego/pull/12)): canonical city (`cityPlaceId`, `cityCountryCode`, `cityNameEn`/`Uk`, lat/lon; legacy `city` kept) | client + masseur | [BR-017](decisions.md#br-017) |
| **Implemented** ([#12](https://github.com/dmytro-koliasa/massagego/pull/12)): `preferredLocale` (`en` \| `uk`) | both | [BR-009](decisions.md#br-009) |
| **Implemented** ([#17](https://github.com/dmytro-koliasa/massagego/pull/17), [#18](https://github.com/dmytro-koliasa/massagego/pull/18)): per-event channel prefs via `NotificationPreference` (email + Telegram) | both | [BR-009](decisions.md#br-009) |
| **Implemented** ([#18](https://github.com/dmytro-koliasa/massagego/pull/18)): `telegramChatId`, `telegramLinkedAt`, `telegramAwaitingPhoneConfirm` | both | [BR-009](decisions.md#br-009) |
| **Implemented** ([#18](https://github.com/dmytro-koliasa/massagego/pull/18)): `phoneConfirmedAt` (optional Telegram contact share) | both | [BR-023](decisions.md#br-023) |
| **Implemented** ([#27](https://github.com/dmytro-koliasa/massagego/pull/27)): `reminderHours` (null = Off; else 2/4/12/24, default 24) | masseur | [BR-009](decisions.md#br-009) |
| **Implemented** ([#20](https://github.com/dmytro-koliasa/massagego/pull/20)): `blockedAt` | both (not admin) | [BR-021](decisions.md#br-021) |
| **Implemented** ([#19](https://github.com/dmytro-koliasa/massagego/pull/19)): `deletedAt` + anonymisation | both | [BR-011](decisions.md#br-011) |

### `Booking`

| Change | Decision |
|---|---|
| **Implemented** ([#4](https://github.com/dmytro-koliasa/massagego/pull/4)): enum `BookingStatus` (`confirmed`, `cancelled`) | [BR-005](decisions.md#br-005) |
| **Implemented** ([#4](https://github.com/dmytro-koliasa/massagego/pull/4)): `cancelledBy`, `cancelledAt` | [BR-005](decisions.md#br-005) |
| **Implemented** ([#4](https://github.com/dmytro-koliasa/massagego/pull/4), [#9](https://github.com/dmytro-koliasa/massagego/pull/9)): `cancelReason` / `cancelReasonText`; client cancel requires a reason | [BR-004](decisions.md#br-004), [BR-011](decisions.md#br-011) |
| **Implemented** ([#4](https://github.com/dmytro-koliasa/massagego/pull/4)): indexes on (`status`, `cancelledAt`) and (`status`, `slotStart`) for cleanup | [BR-011](decisions.md#br-011), [BR-018](decisions.md#br-018) |
| **Implemented** ([#9](https://github.com/dmytro-koliasa/massagego/pull/9)): exclusion `Booking_no_overlapping_active_client_slots` | [BR-008](decisions.md#br-008) |
| **Implemented** ([#9](https://github.com/dmytro-koliasa/massagego/pull/9)): client bookings copy `User.name` + `User.phone` at create | [BR-008](decisions.md#br-008) |
| **Implemented** ([#4](https://github.com/dmytro-koliasa/massagego/pull/4)): removed `preferredDate`, `preferredTime`, `clientEmail`; `clientUserId` comment fixed | C-8 |
| **Implemented** ([#19](https://github.com/dmytro-koliasa/massagego/pull/19)): `hasRetentionHold` (cleanup skips `true`) | [BR-011](decisions.md#br-011), [BR-018](decisions.md#br-018) |
| **Implemented** ([#27](https://github.com/dmytro-koliasa/massagego/pull/27)): `reminderSentAt` | [BR-009](decisions.md#br-009) |

### `AvailabilitySlot`

No schema change. Rules only: working window in masseur TZ, past edits rejected, weekly copy max **17** weeks ([#7](https://github.com/dmytro-koliasa/massagego/pull/7), [#8](https://github.com/dmytro-koliasa/massagego/pull/8)).

## 2. New tables or records

| Item | Purpose | Decision |
|---|---|---|
| **Implemented** ([#17](https://github.com/dmytro-koliasa/massagego/pull/17)): `NotificationOutbox` + `NotificationPreference` | Delivery, retries, prefs (XR-1 payloads) | [BR-009](decisions.md#br-009) |
| **Implemented** (2026-11-18): `InAppNotification` | In-app feed: recipient, event type, title/body/href, `readAt`, `createdAt`; ~30-day retention | [BR-009](decisions.md#br-009) |
| **Implemented** ([#18](https://github.com/dmytro-koliasa/massagego/pull/18)): Telegram link tokens via `VerificationToken` (`telegram-link:` prefix) | One-time bot connect | [BR-009](decisions.md#br-009) |
| **Implemented** ([#12](https://github.com/dmytro-koliasa/massagego/pull/12), [#13](https://github.com/dmytro-koliasa/massagego/pull/13)): `VerificationToken` reused for email verify + password reset | Confirm email / reset | [BR-009](decisions.md#br-009), [BR-019](decisions.md#br-019) |
| **Implemented** ([#13](https://github.com/dmytro-koliasa/massagego/pull/13)): `RateLimitBucket` | Sliding-window rate limits (BR-020) | [BR-020](decisions.md#br-020) |
| **Implemented** ([#20](https://github.com/dmytro-koliasa/massagego/pull/20)): `AdminAuditLog` | Admin action audit (XR-1) | [BR-021](decisions.md#br-021) |
| **Implemented** ([#26](https://github.com/dmytro-koliasa/massagego/pull/26)): `Complaint` (+ category/status enums) | User complaints for admin | [BR-021](decisions.md#br-021) |
| **Implemented** ([#19](https://github.com/dmytro-koliasa/massagego/pull/19)): `Booking.hasRetentionHold` | Hold rows out of hard delete | [BR-011](decisions.md#br-011), [BR-018](decisions.md#br-018) |
| **Deferred** | Separate **payment** records / richer obligation model | [BR-015](decisions.md#br-015) (with hold stub already shipped) |

## 3. Configuration and constants in code

Constants live in `src/lib/booking-constants.ts` ([#5](https://github.com/dmytro-koliasa/massagego/pull/5), [#8](https://github.com/dmytro-koliasa/massagego/pull/8)): session length, working window, default masseur TZ, 120-day window, weekly copy default **12** / max **17**, lead and cutoff option lists, cap of 30, both retention periods.

| Item | Value | Decision |
|---|---|---|
| Session length | 60 minutes | [BR-001](decisions.md#br-001) |
| Working window | 05:00–23:00 in the masseur's timezone | [BR-007](decisions.md#br-007) |
| Booking window for clients | 120 days (date-based, masseur TZ) | [BR-003](decisions.md#br-003) |
| Weekly copy limit | **17 weeks** ([#8](https://github.com/dmytro-koliasa/massagego/pull/8)) | [BR-003](decisions.md#br-003) |
| Active future bookings per client | 30 | [BR-008](decisions.md#br-008) |
| Cancelled booking retention | 7 days from `cancelledAt` | [BR-011](decisions.md#br-011) |
| Completed booking retention | 3 months from `slotStart` | [BR-018](decisions.md#br-018) |
| Excluded countries | shared list for phone and city ([#11](https://github.com/dmytro-koliasa/massagego/pull/11)) | [BR-013](decisions.md#br-013) |
| Cancellation reasons | enum `CancellationReason` ([#4](https://github.com/dmytro-koliasa/massagego/pull/4)); EN/UK in `src/lib/i18n.ts` | [BR-004](decisions.md#br-004) |

## 4. Background jobs

| Job | Frequency | Decision |
|---|---|---|
| **Implemented** ([#19](https://github.com/dmytro-koliasa/massagego/pull/19)): delete cancelled bookings older than 7 days without retention hold | daily cron `/api/cron/cleanup` (+ `npm run cron:cleanup`) | [BR-011](decisions.md#br-011) |
| **Implemented** ([#19](https://github.com/dmytro-koliasa/massagego/pull/19)): delete completed bookings older than 3 months without retention hold | same cleanup cron | [BR-018](decisions.md#br-018) |
| **Implemented** ([#17](https://github.com/dmytro-koliasa/massagego/pull/17), [#27](https://github.com/dmytro-koliasa/massagego/pull/27)): retry failed notifications + claim reminders | every 5 min `/api/cron/notifications` (+ local `npm run cron:notifications`) | [BR-009](decisions.md#br-009) |
| **Implemented** (2026-11-18): delete in-app inbox rows older than ~30 days | daily `/api/cron/cleanup` via `deleteExpiredInAppNotifications` | [BR-009](decisions.md#br-009) |

## 5. Behaviour-only (no new columns) — Implemented

- Lead time, 120-day window, no 60-minute past grace ([#8](https://github.com/dmytro-koliasa/massagego/pull/8) / [BR-002](decisions.md#br-002), [BR-003](decisions.md#br-003)).
- Cancel cutoff + mandatory reason ([#8](https://github.com/dmytro-koliasa/massagego/pull/8), [#9](https://github.com/dmytro-koliasa/massagego/pull/9) / [BR-004](decisions.md#br-004)).
- Availability past / out-of-hours rejection ([#7](https://github.com/dmytro-koliasa/massagego/pull/7) / [BR-007](decisions.md#br-007)).
- Masseur catalog visibility, card label, ordering, default city, no email in list ([#16](https://github.com/dmytro-koliasa/massagego/pull/16) / [BR-010](decisions.md#br-010), [BR-017](decisions.md#br-017)).
- Client overlap + cap 30 + name/phone from account ([#9](https://github.com/dmytro-koliasa/massagego/pull/9) / [BR-008](decisions.md#br-008)).
- Account deletion anonymisation + client future cancel / masseur refuse ([#19](https://github.com/dmytro-koliasa/massagego/pull/19) / [BR-011](decisions.md#br-011)).
- Thai toast hints only ([#10](https://github.com/dmytro-koliasa/massagego/pull/10) / [BR-014](decisions.md#br-014)).
- Shared excluded-country list ([#11](https://github.com/dmytro-koliasa/massagego/pull/11) / [BR-013](decisions.md#br-013)).
- Notification events 1–5 + reminder ([#17](https://github.com/dmytro-koliasa/massagego/pull/17)–[#19](https://github.com/dmytro-koliasa/massagego/pull/19), [#27](https://github.com/dmytro-koliasa/massagego/pull/27) / [BR-009](decisions.md#br-009)).
- Image re-encode checks ([#14](https://github.com/dmytro-koliasa/massagego/pull/14) / [BR-022](decisions.md#br-022)).
- Last-cancellation on slots + recent cancellations list ([#25](https://github.com/dmytro-koliasa/massagego/pull/25), [#28](https://github.com/dmytro-koliasa/massagego/pull/28) / [BR-004](decisions.md#br-004)).

## 6. Still deferred (not in this schema yet)

| Topic | Decision |
|---|---|
| Prices / catalog money fields | [BR-012](decisions.md#br-012) |
| Payments and richer obligation records (hold flag already exists) | [BR-015](decisions.md#br-015) |
| Multi-session courses | [BR-016](decisions.md#br-016) |
| Production DB constraint verify | P-1 |
| Legal / privacy counsel sign-off | P-2 |

Historical build-order notes (timezone before windows, cancel metadata before cleanup, verified email before mail, city + blocklist before catalog defaults) remain true; see [implementation-plan.md](implementation-plan.md) §6 for the original dependency list.
