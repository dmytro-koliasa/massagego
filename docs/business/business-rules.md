# Business Rules

> **Status:** **as-is snapshot** of `master` at commit `f29ca32` (2026-11-15).
> This document records what the code **does today**. Sections 1-9 are **not approved product requirements**; only the section "Approved rules" below is binding.
> Nothing here was verified against production data or a production deployment.
> Open decisions (`BR-xxx`) and inconsistencies (`C-x`) are tracked in [decisions.md](decisions.md).

## How to read this document

Every rule carries one of three classifications:

| Tag | Meaning |
|---|---|
| **Implemented** | Confirmed in source code. Describes actual behavior, with file references. It may still be an accidental default rather than an approved requirement. |
| **Needs Decision** | Missing, unclear or inconsistent. A product owner must decide. Linked to a `BR-xxx` item in [decisions.md](decisions.md). |
| **Proposed** | A suggested improvement. **Not approved and not implemented.** |

Related documents: [decisions.md](decisions.md), [user-roles.md](user-roles.md), [booking-lifecycle.md](booking-lifecycle.md).

## Approved rules

Rules the product owner has approved **and** that are implemented. A rule is added here only once its implementation is merged (track 2 of the workflow in [decisions.md](decisions.md#workflow)). Decisions that are **Approved** but not yet implemented stay in decisions.md.

| ID | Rule | Source decision | Implemented in |
|---|---|---|---|
| AR-1 | A booking has exactly one of two statuses: `confirmed` (it occupies the hour from creation; there is no masseur confirmation) or `cancelled`. The database rejects any other value. Whether a session took place is derived from time; there are no post-session statuses. | [BR-005](decisions.md#br-005) | `prisma/schema.prisma` (`enum BookingStatus`, `Booking.status`); `src/app/api/bookings/route.ts` (`POST`); `src/app/api/masseur/bookings/route.ts` (`POST`); migration `20261116174000_booking_status_and_cancel_data`; [#4](https://github.com/dmytro-koliasa/massagego/pull/4) |
| AR-2 | A cancelled booking records who cancelled (`cancelledBy`: `client` or `masseur`) and when (`cancelledAt`). The client cancel and the masseur cancel both set them. | [BR-005](decisions.md#br-005) | `src/app/api/bookings/cancel/route.ts`; `src/app/api/masseur/bookings/resolve/route.ts`; `prisma/schema.prisma` (`enum CancelledBy`); [#4](https://github.com/dmytro-koliasa/massagego/pull/4) |
| AR-3 | Every status except `cancelled` occupies the hour in the overlap constraint `Booking_no_overlapping_active_slots`; it must be reviewed whenever a status is added. | [BR-005](decisions.md#br-005) | migration `20261116174000_booking_status_and_cancel_data`; `tests/booking-status.test.ts`, `tests/booking-concurrency.test.ts`; [#4](https://github.com/dmytro-koliasa/massagego/pull/4) |
| AR-4 | `Booking` stores no unused contact or legacy fields (`preferredDate`, `preferredTime`, `clientEmail` removed); `clientUserId` is empty for masseur walk-in bookings. | C-8 ([decisions.md](decisions.md#code-inconsistencies)) | `prisma/schema.prisma` (`Booking`); migration `20261116174000_booking_status_and_cancel_data`; [#4](https://github.com/dmytro-koliasa/massagego/pull/4) |
| AR-5 | Every session is exactly 60 minutes. The length is one shared constant used by the routes and the calendars; the overlap constraint uses the same hour in SQL. | [BR-001](decisions.md#br-001) | `src/lib/booking-constants.ts` (`SESSION_MINUTES`, `SLOT_MS`, `CALENDAR_SLOT_DURATION`); [#5](https://github.com/dmytro-koliasa/massagego/pull/5) |
| AR-6 | Each masseur has an IANA time zone (default `Europe/Kyiv`). The server aligns slot starts to the hour, checks the 05:00-23:00 window and copies weeks in the masseur's zone, never in the server's local time; a copied week keeps the same local clock time across daylight-saving changes. Instants are stored in UTC. | [BR-006](decisions.md#br-006) (server side) | `prisma/schema.prisma` (`User.timezone`); `src/lib/masseur-time.ts`, `src/lib/masseur-time.server.ts`; `src/app/api/masseur/availability/route.ts`; `src/app/api/bookings/route.ts`; `src/app/api/bookings/cancel/route.ts`; `src/app/api/masseur/bookings/route.ts`; `src/app/api/masseur/bookings/resolve/route.ts`; `tests/masseur-time.test.ts`, `tests/masseur-timezone-routes.test.ts`; [#5](https://github.com/dmytro-koliasa/massagego/pull/5) |
| AR-7 | The masseur availability calendar and the client booking calendar show days and hours in the masseur's time zone with the line "Times in {label}" / "Час: {label}". The client sessions calendar stays in the browser's zone and labels each event with that masseur's zone. Availability and bookings APIs return `timezone`. | [BR-006](decisions.md#br-006) (display) | `src/lib/calendar-time.ts`; `src/components/masseur-availability-calendar.tsx`; `src/components/client-booking-calendar.tsx`; `src/components/client-sessions-calendar.tsx`; `src/app/api/masseur/availability/route.ts`; `src/app/api/masseurs/[id]/availability/route.ts`; `src/app/api/bookings/route.ts`; [#6](https://github.com/dmytro-koliasa/massagego/pull/6) |
| AR-8 | The global working window 05:00–23:00 (masseur time zone) is enforced on every write path: manual availability changes, weekly copy (including a supplied template) and masseur walk-in bookings. Adding or removing a started availability slot is rejected by the server (`slot_in_past`). | [BR-007](decisions.md#br-007) | `src/app/api/masseur/availability/route.ts`; `src/app/api/masseur/bookings/route.ts`; `src/lib/masseur-time.ts` (`isSlotStarted`); `tests/availability-rules.test.ts`; [#7](https://github.com/dmytro-koliasa/massagego/pull/7) |
| AR-9 | Clients only see masseurs with a complete profile (name in at least one language, canonical city, address, phone) and at least one availability record ever. Cards show a green/red nearest-free-time plaque; free-time masseurs sort first; unlisted profiles open by link but cannot be booked; the list API does not return masseur email. | [BR-010](decisions.md#br-010), C-9 | `src/lib/masseur-catalog.ts`; `src/app/api/masseurs/route.ts`; `src/components/client-masseurs-view.tsx`; `src/app/client/masseur/[slug]/page.tsx`; `tests/masseur-catalog.test.ts`; PR 11 (`feat/masseur-catalog`) |
| AR-10 | Client cancellation requires a listed reason ("Other" needs text ≤200); the per-masseur cancel cutoff is enforced; own already-cancelled booking succeeds; missing or foreign booking returns the same `404 not_found`. | [BR-004](decisions.md#br-004), C-7 | `src/app/api/bookings/cancel/route.ts`; [#9](https://github.com/dmytro-koliasa/massagego/pull/9) |
| AR-11 | Password reset is a one-time email link (1 h); clients request by phone, masseurs by email; clients still sign in with phone + password only. | [BR-019](decisions.md#br-019) | `src/app/api/auth/password-reset/*`; [#13](https://github.com/dmytro-koliasa/massagego/pull/13) |
| AR-12 | Sensitive auth and booking endpoints use Postgres sliding-window rate limits per IP and per account. | [BR-020](decisions.md#br-020) | `src/lib/rate-limit.ts`; `RateLimitBucket`; [#13](https://github.com/dmytro-koliasa/massagego/pull/13) |
| AR-13 | Uploaded images are content-checked and re-saved with sharp (JPEG/PNG/WebP in; metadata stripped; max long side 2000px). | [BR-022](decisions.md#br-022) | `src/lib/image-process.ts` (or equivalent); [#14](https://github.com/dmytro-koliasa/massagego/pull/14) |
| AR-14 | Notifications: email is the main channel; optional Telegram; events 1–5 via outbox; per-event per-channel prefs; event 4 on client account deletion. | [BR-009](decisions.md#br-009) | [#17](https://github.com/dmytro-koliasa/massagego/pull/17), [#18](https://github.com/dmytro-koliasa/massagego/pull/18), [#19](https://github.com/dmytro-koliasa/massagego/pull/19) |
| AR-15 | Optional phone confirmation via Telegram contact share sets `phoneConfirmedAt` (not required to register or book). | [BR-023](decisions.md#br-023) | [#18](https://github.com/dmytro-koliasa/massagego/pull/18) |
| AR-16 | Self-service account deletion anonymises the user; client deletion auto-cancels future bookings (event 4); masseur deletion refused while future bookings exist; cancelled bookings without a retention hold are hard-deleted ~7 days after `cancelledAt`; completed bookings without a hold ~3 months after `slotStart`. | [BR-011](decisions.md#br-011), [BR-018](decisions.md#br-018) | `src/lib/account-deletion.ts`; `src/app/api/cron/cleanup/route.ts`; [#19](https://github.com/dmytro-koliasa/massagego/pull/19) |
| AR-17 | Separate `admin` portal: env bootstrap of one super-admin; user list with Active/Blocked/Deleted filters; block/unblock client and masseur only; blocked users cannot sign in or create bookings (existing bookings stay); `AdminAuditLog` + `/admin/audit`. | [BR-021](decisions.md#br-021) | `src/app/admin/*`; `src/app/api/admin/*`; [#20](https://github.com/dmytro-koliasa/massagego/pull/20) |
| AR-18 | Masseur slot details show the latest client cancellation reason for that hour within 7 days (`lastCancellation` on availability slots); masseur cancels without a reason are not shown; consecutive hours each have their own last cancellation. | [BR-004](decisions.md#br-004) | `src/lib/last-cancellation.ts`; `src/app/api/masseur/availability/route.ts`; `src/components/masseur-availability-calendar.tsx` |
| AR-19 | Clients and masseurs may file a complaint about each other only when linked by an account booking; walk-ins excluded; admin reviews at `/admin/complaints` (status + note); target does not see the complaint; rate-limited. | [BR-021](decisions.md#br-021) | `Complaint` model; `src/lib/complaints.ts`; `src/app/api/complaints`; `src/app/admin/complaints` |

Timezone choice for masseurs and related profile fields were delivered with registration/profile work (PR 8 / [#12](https://github.com/dmytro-koliasa/massagego/pull/12)).

---

## 1. Summary of the current model

- Two separate portals (`masseur`, `client`) with separate identities, cookies and sessions.
- A masseur publishes **one-hour availability slots**. A client books one or more of them. A masseur may also book a slot for a walk-in/phone client.
- A booking occupies exactly one hour, is created as `pending`, and can only ever become `cancelled`. *(Superseded: `pending` is now `confirmed`, see AR-1.)*
- A cancelled booking frees its hour; the hour can be booked again as a **new** row.
- Double-booking is prevented by an application check, a per-masseur transaction lock, and a PostgreSQL exclusion constraint.

---

## 2. Booking creation

### 2.1 Who can create bookings — Implemented

| Actor | Endpoint | Source |
|---|---|---|
| Client (authenticated, `client` portal) | `POST /api/bookings` | `src/app/api/bookings/route.ts` (`POST`) |
| Masseur, for a walk-in/phone client | `POST /api/masseur/bookings` | `src/app/api/masseur/bookings/route.ts` (`POST`) |

The two endpoints follow **different rules** (see the comparison table below). They are not interchangeable.

### 2.2 Comparison of the two creation paths — Implemented

| Rule | Client `POST /api/bookings` | Masseur `POST /api/masseur/bookings` |
|---|---|---|
| Slots per request | One or more (`slotStarts[]`, no maximum) | Exactly one (`slotStart`) |
| Atomicity | All slots succeed or none (single transaction) | Single slot |
| Requires an existing `AvailabilitySlot` | **Yes** (`slot_unavailable` otherwise) | **No** - the route upserts the availability row |
| Business-hours check (05:00-23:00) | No (only indirectly, via the availability row) | **No** |
| Rejects slots that already started | Only if started **more than 60 min ago** (`slotStart < now - SLOT_MS`) | If the slot has started at all (`start <= now`) |
| `clientUserId` | Set to the logged-in client | `null` (walk-in) |
| Client name / phone | Supplied in the request body (not read from the profile) | Supplied in the request body |
| Initial status | `pending` (now `confirmed`, AR-1) | `pending` (now `confirmed`, AR-1) |
| Conflict response | `409 slot_taken` | `409 slot_taken` |

### 2.3 Common input rules — Implemented

Source: `src/lib/validation/booking.ts`, `src/lib/validation/common.ts`.

- `clientName`: required, trimmed, max 80 characters (`NAME_MAX`).
- `clientPhone`: required, must be a valid international number **except** excluded countries (`checkBookingPhone`, `EXCLUDED_COUNTRY_CODES` / [BR-013](decisions.md#br-013)); stored as E.164.
- `note`: optional, max 200 characters (`NOTE_MAX`).
- `massageType`: see section 2.5.
- Each requested start time is **aligned down to the hour** (`alignToHour`, `setMinutes(0,0,0)`); duplicates in one request collapse into one.

### 2.4 Slot must be offered and free — Implemented

For each slot, inside one transaction (client route: `prisma.$transaction`):

1. Take a per-masseur advisory lock (`lockMasseurBookings`, `src/lib/booking-conflict.ts`).
2. An `AvailabilitySlot` with `(masseurId, start)` must exist (client route only).
3. No non-cancelled booking may exist for `(masseurId, slotStart)`; otherwise `slot_taken`.
4. Insert the booking. The database exclusion constraint is the final guard.

### 2.5 Massage type — Implemented

- A masseur configures offered types (`User.massageTypes`, JSON string; 18 predefined ids plus `custom:<text>`, custom text max 40 chars; `src/lib/massage-types.ts`).
- If the masseur offers **at least one** type, the request **must** include one of them, otherwise `invalid_massage_type` (400).
- If the masseur offers **none**, the booking is stored with `massageType = null` and any submitted value is ignored.
- One massage type applies to all slots of a multi-slot client request.
- There is no price, per-type duration, or per-type availability. See [BR-012](decisions.md#br-012).

### 2.6 Rebooking and slot reuse — Implemented

- A booking is never edited into a different time. To move a booking, the client cancels and creates a new one.
- A cancelled booking row is kept (`status = 'cancelled'`) and no longer occupies the hour. The hour can be booked again, by anyone, as a new row.

---

## 3. Session duration

- **Implemented:** every session is exactly **60 minutes**. This is a constant (`SLOT_MS`) duplicated in the booking routes, the availability routes, the masseur resolve route, and the calendar components (`slotDuration="01:00:00"`).
- **Implemented:** `AvailabilitySlot.end` is stored but always equals `start + 1h`. `Booking` stores **only** `slotStart`; its end is always derived as `slotStart + 1h`.
- The database exclusion constraint `Booking_no_overlapping_active_slots` hard-codes `interval '1 hour'`.
- *(Superseded: the length is now an approved rule with one shared constant, AR-5.)*
- **Classification:** the 60-minute length is a **technical default**. No document, schema comment or configuration marks it as an approved requirement. Changing it touches the constants above, the calendar UI, the migration, and the data model (no stored end/duration on `Booking`). See [BR-001](decisions.md#br-001).

---

## 4. Available booking times

### 4.1 Working hours — Implemented (with inconsistencies)

- Fixed window **05:00-23:00** (last slot starts 22:00). Constants `DAY_START_HOUR = 5`, `DAY_END_HOUR = 23` in `src/app/api/masseur/availability/route.ts` (`isWithinBusinessHours`) and `src/components/masseur-availability-calendar.tsx`; calendars use `slotMinTime="05:00:00"`, `slotMaxTime="23:00:00"`.
- It is **global**: not configurable per masseur.
- It is enforced **only** when a masseur edits availability (`POST /api/masseur/availability`, error `out_of_hours`). It is **not** enforced by the weekly-copy template (`PUT`) or by the masseur walk-in booking route.
- The server evaluates the window with `Date.getHours()` (server-local time) while the UI evaluates it in the browser's local time. See [timezone](#7-timezone-handling) and inconsistency C-2. *(Superseded on the server: the window is evaluated in the masseur's time zone, AR-6; the UI still uses the browser's time zone.)*

### 4.2 Days off - Needs Decision

- There is **no** days-off or time-off concept, no recurring schedule, and no holiday calendar. A day is "off" only because no `AvailabilitySlot` rows exist for it.
- Availability is edited hour by hour, or copied forward from the current week (section 4.3). See [BR-007](decisions.md#br-007).

### 4.3 Weekly copy — Implemented

`PUT /api/masseur/availability`:

- Only allowed while "now" is inside the source week (`not_current_week` otherwise).
- Copies the week's slots (or a client-supplied template) forward by 1-52 weeks (default 12; `weeksAhead`).
- First **deletes** existing future availability in the target range, except hours that already have an active booking; then inserts the copy. Booked hours are skipped when copying.
- Dates are shifted with `setDate(+7 days)` in server-local time (see C-6). *(Superseded: weeks are added in the masseur's time zone keeping the local clock time, AR-6.)*

### 4.4 What a client sees — Implemented

`GET /api/masseurs/[id]/availability` returns, for the requested range **clipped to "now"** (`rangeStart = max(from, now)`):

- Availability slots as `available`, or `booked` if a non-cancelled booking exists.
- Hours booked by someone else appear as `booked` with **no** detail; the client's own bookings expose `bookingId` and `massageType`.
- Past hours are not returned, so past slots are invisible in the booking calendar.

---

## 5. Overlap prevention — Implemented

Three layers, all keyed on "active" = `status <> 'cancelled'`:

| Layer | Where | Behavior |
|---|---|---|
| Existence check | `POST /api/bookings`, `POST /api/masseur/bookings` | Reject with `slot_taken` if an active booking has the same `(masseurId, slotStart)` |
| Transaction lock | `lockMasseurBookings` - `pg_advisory_xact_lock(hashtextextended(masseurId, 0))` | Serialises booking creation per masseur so contenders queue instead of deadlocking |
| Database constraint | Migration `20261115120000_booking_no_overlap`: `EXCLUDE USING gist ("masseurId" WITH =, tsrange("slotStart", "slotStart" + interval '1 hour') WITH &&) WHERE ("slotStart" IS NOT NULL AND "status" <> 'cancelled')` | Final guarantee, including partial overlaps (e.g. 10:00 vs 10:30) |

Notes:

- Conflicts surface as `409 slot_taken` (`isBookingConflictError`).
- The constraint applies **per masseur only**. Nothing stops the same **client** from holding overlapping bookings with different masseurs. See [BR-008](decisions.md#br-008).
- Rows with `slotStart IS NULL` (legacy pre-slot bookings) are outside the constraint. No code path creates them any more.
- **Operational status:** the migration was verified only against local Docker PostgreSQL 16. Production migration status is **unknown** and must not be assumed. The migration requires the `btree_gist` extension and aborts if overlapping active bookings already exist.

---

## 6. Time restrictions

### 6.1 Minimum advance booking - Needs Decision ([BR-002](decisions.md#br-002))

There is **no** configurable lead time. Actual behavior:

- Client UI/availability endpoint: slots whose hour has already started are hidden.
- Client API: accepts a start up to **60 minutes in the past** (`slotStart.getTime() < now - SLOT_MS` is the rejection test).
- Masseur API: rejects any slot with `start <= now`.

### 6.2 Maximum advance booking - Needs Decision ([BR-003](decisions.md#br-003))

There is **no** upper limit. A client may book any existing future availability row. Availability itself can be created up to 52 weeks ahead via weekly copy; individual hours can be toggled for any future week the calendar navigates to.

### 6.3 Cancellation restrictions - Needs Decision ([BR-004](decisions.md#br-004))

| Actor | Time restriction | Source |
|---|---|---|
| Client | **None.** May cancel any own non-cancelled booking, including a session already in progress or in the past | `src/app/api/bookings/cancel/route.ts` |
| Masseur | Cancellation (`resolve`) rejected when `slotStart <= now` | `src/app/api/masseur/bookings/resolve/route.ts` |

No cancellation window, fee, reason, or notification exists. See [booking-lifecycle.md](booking-lifecycle.md).

### 6.4 Editing availability in the past - Implemented (UI only)

The masseur UI blocks changes to started hours (`isSlotExpired`). `POST /api/masseur/availability` has **no** past-time check. See C-4.

---

## 7. Timezone handling

- **Storage:** all instants are stored as UTC `timestamp(3)` (Prisma `DateTime`); the API exchanges ISO-8601 strings.
- **No per-user or per-masseur timezone is stored.** Calendar times are rendered in each viewer's **browser** timezone, so a client in another timezone sees different clock times for the same slot.
- **Hour alignment** (`alignToHour`) uses `Date.setMinutes(0,0,0)`, i.e. the **server's** local timezone. For whole-hour-offset zones (which covers all EU countries and Ukraine, the supported phone markets) this is identical to UTC alignment, so it is currently harmless. It would misalign in zones with 30/45-minute offsets.
- **Business hours** and **weekly copy** use server-local `getHours()` / `setDate()`. If the server runs in UTC (typical for hosted environments) while users are in Europe/Kyiv, the 05:00-23:00 window and the +7-day shift do not match the users' local clocks (C-2, C-6). The deployment's actual server timezone was not verified.
- **Classification:** timezone handling is a **technical implementation**, not an approved rule. See [BR-006](decisions.md#br-006).
- *(Superseded on the server: each masseur has a stored time zone, and alignment, the working window and the weekly copy use it, AR-6. Display is still browser-local.)*

---

## 8. Cancelled bookings and slot reuse — Implemented

- Cancelling sets `status = 'cancelled'`; the row is retained.
- All availability queries, conflict checks and the DB constraint treat only `cancelled` as "free". Any other status string would block the slot (today no other status besides `pending` is ever written). *(Superseded: the status is now an enum with only `confirmed` and `cancelled`, AR-1, AR-3.)*
- **Client cancel:** the `AvailabilitySlot` is untouched, so the hour becomes bookable again immediately.
- **Masseur cancel (`resolve`):** the masseur chooses `availability: "available"` (slot upserted, bookable again) or `"unavailable"` (slot deleted).
- A cancelled booking disappears from the client's session list (`GET /api/bookings` filters out `cancelled`) and from the masseur calendar.

---

## 9. Other rules discovered

### 9.1 Accounts and authentication - Implemented

Source: `src/auth/*`, `src/lib/validation/auth.ts`, `src/app/api/auth/register/route.ts`.

- Identity is per portal: `@@unique([email, portal])`, `@@unique([phone, portal])`. The same person can hold one masseur and one client account.
- Masseur: email + password, or Google (Google only enabled for the masseur portal, and only when credentials are configured).
- Client: **phone** + password; the stored email is synthesised from the phone (`clientEmailFromPhone`).
- Password: 8-64 characters, must contain a letter, a digit and a symbol.
- Sessions are JWT, with a separate cookie per portal.
- Rate limiting, email verification, password reset and account deletion are implemented (see AR-11, AR-12, AR-16).

### 9.2 Masseur profile - Implemented

- City and address are **required** to save a profile; names and descriptions are optional, per language (`en`, `uk`). Description max 200 characters.
- A public `slug` is assigned once and then kept stable; client links work by slug or legacy id.
- Gallery: max **3** images, JPEG/PNG only, max 5 MB each (`src/app/api/masseur/gallery/route.ts`).
- City search uses OpenStreetMap Nominatim (masseur-only endpoint).

### 9.3 Masseur discovery - Implemented ([BR-010](decisions.md#br-010); see AR-9)

`GET /api/masseurs` lists only masseurs with a complete profile and at least one availability record ever (paginated, optional city filter). Cards include a nearest-free-time label; email is not returned.

### 9.4 Data lifecycle - Implemented ([BR-011](decisions.md#br-011), [BR-018](decisions.md#br-018); see AR-16)

- Self-service deletion anonymises the account (`deletedAt`, synthetic email, cleared PII, sessions and Telegram).
- Client deletion auto-cancels future bookings (`client_account_deleted`) and notifies masseurs (event 4).
- Masseur deletion is refused while active future bookings exist.
- Cron `GET /api/cron/cleanup` hard-deletes cancelled bookings (~7 days) and completed bookings (~3 months) unless `hasRetentionHold`.

---

## Decisions and findings

Open business decisions (`BR-001`...`BR-013`) and the code inconsistencies (`C-1`...`C-9`) referenced in this document are tracked in [decisions.md](decisions.md), with options, recommendations and status.

---

## Verification of the working assumptions

| # | Assumption | Verified? | Business requirement or technical choice? |
|---|---|---|---|
| 1 | Sessions last exactly 60 min | Yes - constant in routes, UI and DB | **Technical default**; no approved requirement found ([BR-001](decisions.md#br-001)) |
| 2 | DB constraint assumes one-hour sessions | Yes - `interval '1 hour'` in the migration | **Technical consequence** of #1 |
| 3 | Only `cancelled` releases a slot | Yes - all queries and the constraint | **Technical**; holds only because no other status exists ([BR-005](decisions.md#br-005)). Now an approved rule (AR-1, AR-3) |
| 4 | Booking times aligned in server timezone | Yes - `setMinutes(0,0,0)`; business-hours/weekly copy also server-local | **Technical**; harmless for alignment in whole-hour zones, **not** harmless for the hours window ([BR-006](decisions.md#br-006)) |
| 5 | Separate client and masseur creation endpoints | Yes | **Technical split that encodes different rules** (section 2.2): walk-ins skip the availability requirement and the hours check |
| 6 | Locking plus exclusion constraint for concurrency | Yes - `lockMasseurBookings` and migration `20261115120000_booking_no_overlap` | **Technical** safeguard of the "no double booking" requirement, which is the only clearly intended business rule |
| 7 | Production migration status | **Not verified.** Tested only on local PostgreSQL 16. It is unknown whether production has the migration, `btree_gist`, or overlapping legacy data | Operational, not a business rule |
