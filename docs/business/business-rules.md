# Business Rules

> **Status:** descriptive snapshot of `master` at commit `f29ca32` (2026-11-15).
> This document records what the code **does today**. It is not a statement of approved product requirements.
> Nothing here was verified against production data or a production deployment.

## How to read this document

Every rule carries one of three classifications:

| Tag | Meaning |
|---|---|
| **Implemented** | Confirmed in source code. Describes actual behavior, with file references. It may still be an accidental default rather than an approved requirement. |
| **Needs Decision** | Missing, unclear or inconsistent. A product owner must decide. Linked to a `BR-xxx` item in the [Open decisions](#open-decisions) section. |
| **Proposed** | A suggested improvement. **Not approved and not implemented.** |

Related documents: [user-roles.md](user-roles.md), [booking-lifecycle.md](booking-lifecycle.md).

---

## 1. Summary of the current model

- Two separate portals (`masseur`, `client`) with separate identities, cookies and sessions.
- A masseur publishes **one-hour availability slots**. A client books one or more of them. A masseur may also book a slot for a walk-in/phone client.
- A booking occupies exactly one hour, is created as `pending`, and can only ever become `cancelled`.
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
| Initial status | `pending` | `pending` |
| Conflict response | `409 slot_taken` | `409 slot_taken` |

### 2.3 Common input rules — Implemented

Source: `src/lib/validation/booking.ts`, `src/lib/validation/common.ts`.

- `clientName`: required, trimmed, max 80 characters (`NAME_MAX`).
- `clientPhone`: required, must be a valid number **from an EU country or Ukraine** (`isAllowedBookingPhone`, `PHONE_COUNTRIES_EU_UA`); stored as E.164.
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
- There is no price, per-type duration, or per-type availability. See [BR-012](#br-012).

### 2.6 Rebooking and slot reuse — Implemented

- A booking is never edited into a different time. To move a booking, the client cancels and creates a new one.
- A cancelled booking row is kept (`status = 'cancelled'`) and no longer occupies the hour. The hour can be booked again, by anyone, as a new row.

---

## 3. Session duration

- **Implemented:** every session is exactly **60 minutes**. This is a constant (`SLOT_MS`) duplicated in the booking routes, the availability routes, the masseur resolve route, and the calendar components (`slotDuration="01:00:00"`).
- **Implemented:** `AvailabilitySlot.end` is stored but always equals `start + 1h`. `Booking` stores **only** `slotStart`; its end is always derived as `slotStart + 1h`.
- The database exclusion constraint `Booking_no_overlapping_active_slots` hard-codes `interval '1 hour'`.
- **Classification:** the 60-minute length is a **technical default**. No document, schema comment or configuration marks it as an approved requirement. Changing it touches the constants above, the calendar UI, the migration, and the data model (no stored end/duration on `Booking`). See [BR-001](#br-001).

---

## 4. Available booking times

### 4.1 Working hours — Implemented (with inconsistencies)

- Fixed window **05:00-23:00** (last slot starts 22:00). Constants `DAY_START_HOUR = 5`, `DAY_END_HOUR = 23` in `src/app/api/masseur/availability/route.ts` (`isWithinBusinessHours`) and `src/components/masseur-availability-calendar.tsx`; calendars use `slotMinTime="05:00:00"`, `slotMaxTime="23:00:00"`.
- It is **global**: not configurable per masseur.
- It is enforced **only** when a masseur edits availability (`POST /api/masseur/availability`, error `out_of_hours`). It is **not** enforced by the weekly-copy template (`PUT`) or by the masseur walk-in booking route.
- The server evaluates the window with `Date.getHours()` (server-local time) while the UI evaluates it in the browser's local time. See [timezone](#7-timezone-handling) and inconsistency C-2.

### 4.2 Days off - Needs Decision

- There is **no** days-off or time-off concept, no recurring schedule, and no holiday calendar. A day is "off" only because no `AvailabilitySlot` rows exist for it.
- Availability is edited hour by hour, or copied forward from the current week (section 4.3). See [BR-007](#br-007).

### 4.3 Weekly copy — Implemented

`PUT /api/masseur/availability`:

- Only allowed while "now" is inside the source week (`not_current_week` otherwise).
- Copies the week's slots (or a client-supplied template) forward by 1-52 weeks (default 12; `weeksAhead`).
- First **deletes** existing future availability in the target range, except hours that already have an active booking; then inserts the copy. Booked hours are skipped when copying.
- Dates are shifted with `setDate(+7 days)` in server-local time (see C-6).

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
- The constraint applies **per masseur only**. Nothing stops the same **client** from holding overlapping bookings with different masseurs. See [BR-008](#br-008).
- Rows with `slotStart IS NULL` (legacy pre-slot bookings) are outside the constraint. No code path creates them any more.
- **Operational status:** the migration was verified only against local Docker PostgreSQL 16. Production migration status is **unknown** and must not be assumed. The migration requires the `btree_gist` extension and aborts if overlapping active bookings already exist.

---

## 6. Time restrictions

### 6.1 Minimum advance booking - Needs Decision ([BR-002](#br-002))

There is **no** configurable lead time. Actual behavior:

- Client UI/availability endpoint: slots whose hour has already started are hidden.
- Client API: accepts a start up to **60 minutes in the past** (`slotStart.getTime() < now - SLOT_MS` is the rejection test).
- Masseur API: rejects any slot with `start <= now`.

### 6.2 Maximum advance booking - Needs Decision ([BR-003](#br-003))

There is **no** upper limit. A client may book any existing future availability row. Availability itself can be created up to 52 weeks ahead via weekly copy; individual hours can be toggled for any future week the calendar navigates to.

### 6.3 Cancellation restrictions - Needs Decision ([BR-004](#br-004))

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
- **Classification:** timezone handling is a **technical implementation**, not an approved rule. See [BR-006](#br-006).

---

## 8. Cancelled bookings and slot reuse — Implemented

- Cancelling sets `status = 'cancelled'`; the row is retained.
- All availability queries, conflict checks and the DB constraint treat only `cancelled` as "free". Any other status string would block the slot (today no other status besides `pending` is ever written).
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
- No rate limiting, email verification, password reset, or account deletion exists.

### 9.2 Masseur profile - Implemented

- City and address are **required** to save a profile; names and descriptions are optional, per language (`en`, `uk`). Description max 200 characters.
- A public `slug` is assigned once and then kept stable; client links work by slug or legacy id.
- Gallery: max **3** images, JPEG/PNG only, max 5 MB each (`src/app/api/masseur/gallery/route.ts`).
- City search uses OpenStreetMap Nominatim (masseur-only endpoint).

### 9.3 Masseur discovery - Needs Decision ([BR-010](#br-010))

`GET /api/masseurs` lists **every** user in the `masseur` portal (paginated, optional city filter). It does not require a completed profile, any offered massage type, or any availability.

### 9.4 Data lifecycle - Needs Decision ([BR-011](#br-011))

- Deleting a masseur cascades to their bookings, slots and gallery. Deleting a client sets `Booking.clientUserId` to null. No deletion feature exists in the app today.

---

## Open decisions

Summary (details in the sections that follow). Priority reflects impact on booking correctness, customer experience and availability.

| ID | Topic | Priority | Recommended |
|---|---|---|---|
| [BR-001](#br-001) | Session duration | High | A: keep fixed 60 min, document as requirement |
| [BR-002](#br-002) | Minimum advance booking / started slots | High | B: single configurable lead time, same on every path |
| [BR-003](#br-003) | Maximum advance booking horizon | Medium | B: 90-day booking window |
| [BR-004](#br-004) | Cancellation policy | High | B: client cutoff (e.g. 24 h) + masseur always allowed pre-start |
| [BR-005](#br-005) | Booking statuses and confirmation | High | A for now: stay at `pending`/`cancelled` but rename `pending`->`confirmed`; defer new states |
| [BR-006](#br-006) | Timezone model | High | B: per-masseur IANA timezone |
| [BR-007](#br-007) | Working hours and days off | Medium | B: per-masseur hours, keep per-hour exceptions |
| [BR-008](#br-008) | Client double-booking across masseurs and limits | Medium | B: block overlapping own bookings |
| [BR-009](#br-009) | Notifications | Medium | B: email/SMS on booking and cancellation |
| [BR-010](#br-010) | Masseur discoverability | Medium | B: list only profiles that are complete and have availability |
| [BR-011](#br-011) | Data retention and account deletion | Low | B: soft-delete + anonymise |
| [BR-012](#br-012) | Pricing and per-type duration | Low | A: out of scope for now |
| [BR-013](#br-013) | Supported phone countries | Low | A: keep EU + UA, document it |

### BR-001

**Business question:** Are all sessions exactly 60 minutes, or should masseurs offer 30/90/120-minute sessions?
**Current implementation:** Fixed 60 min everywhere (`SLOT_MS`, calendars, constraint). `Booking` has no duration field.
**Why a decision is needed:** Real massage services vary in length. The DB constraint and data model cannot represent anything else without a migration.
**Options:**
- **A.** Keep 60 min fixed; document as a product rule.
- **B.** Per-masseur fixed session length (e.g. 60 or 90).
- **C.** Per-booking duration chosen from massage type.
**Recommendation: A** for now: it is the cheapest, consistent with the existing UI, and avoids data-model changes until demand is proven. Revisit before onboarding masseurs who need other lengths.
**Impact:** A - docs only. B/C - UI (calendar slot size, multi-hour selection), API (duration param, availability generation), **DB (new `durationMinutes`/`slotEnd` column and a replacement exclusion constraint on a stored end)**, and backfill of existing rows to 60.

### BR-002

**Business question:** How far in advance must a booking be made, and may a client book an hour that has already started?
**Current implementation:** Client API accepts starts up to 60 min in the past; masseur API rejects any started slot; the client UI hides started slots.
**Why:** Inconsistent across paths (C-1); no minimum lead time, so a client can book the next minute.
**Options:**
- **A.** Reject any started slot on every path; no lead time.
- **B.** One configurable minimum lead time (e.g. 2 h) applied to client bookings; masseur walk-ins exempt or allowed up to start.
- **C.** Per-masseur lead time.
**Recommendation: B**, defaulting to a small value, with the same "started slot" rule on all paths.
**Impact:** UI (hide/disable slots inside the window), API (both create routes), no DB change, no data migration.

### BR-003

**Business question:** How far into the future can a client book?
**Current implementation:** No limit; availability can exist up to 52 weeks ahead.
**Why:** Unbounded horizon increases no-shows and stale availability.
**Options:** **A.** No limit. **B.** Fixed window (e.g. 90 days). **C.** Per-masseur horizon.
**Recommendation: B.**
**Impact:** UI (limit calendar navigation), API (validate in create route and availability GET), no DB change.

### BR-004

**Business question:** When may a booking be cancelled, by whom, and are there consequences?
**Current implementation:** Clients can cancel at any time, including past/ongoing sessions. Masseurs can cancel only before the slot starts. No notice, reason, fee or notification.
**Why:** A client can erase a past booking, which damages the masseur's history; late cancellations have no policy.
**Options:**
- **A.** Keep as is.
- **B.** Client cancellation only until a cutoff before start (e.g. 24 h); masseur may cancel until start; past bookings cannot be cancelled by anyone.
- **C.** B plus a recorded reason and a late-cancel flag.
**Recommendation: B**, as the minimum fix; C once reporting is needed.
**Impact:** UI (disable cancel inside the cutoff), API (`/api/bookings/cancel` time check), DB (none for B; a nullable `cancelledBy`/`cancelReason` for C), existing data unaffected.

### BR-005

**Business question:** Does a booking need masseur confirmation, and are `completed` / `no_show` states needed?
**Current implementation:** Only `pending` (set at creation, never advanced) and `cancelled`. `status` is a free string.
**Why:** `pending` implies an approval step that does not exist; the UI shows bookings as booked/occupied immediately, i.e. effectively confirmed.
**Options:**
- **A.** Treat creation as confirmation: keep two states but give `pending` an accurate name.
- **B.** Add masseur confirm/decline (real `pending` -> `confirmed`/`declined`).
- **C.** Add post-session states (`completed`, `no_show`).
**Recommendation: A now**, B/C only if the product needs approval or reporting. Whichever is chosen, constrain `status` to an enum.
**Impact:** UI labels; API; **DB** (rename or enum migration, and the exclusion constraint's `<> 'cancelled'` predicate must be reviewed for any new releasing state such as `declined`).

### BR-006

**Business question:** In which timezone are working hours, slots and "today" defined?
**Current implementation:** UTC storage, browser-local display, server-local alignment and business-hours check (C-2, C-6).
**Why:** Behavior depends on the hosting server's timezone and on each viewer's browser; this directly affects availability correctness.
**Options:** **A.** Assume one fixed timezone (Europe/Kyiv) everywhere. **B.** Store an IANA timezone per masseur; compute hours and display in it. **C.** Keep browser-local.
**Recommendation: B** (A is acceptable as a stopgap if all masseurs are in one zone).
**Impact:** UI (render calendars in masseur tz and say so), API (hour validation and weekly copy in that tz), **DB** (new `User.timezone`), existing data needs a default timezone.

### BR-007

**Business question:** Can masseurs set their own working hours, days off and holidays?
**Current implementation:** Global 05:00-23:00; no days-off concept; availability set per hour; weekly copy as a shortcut; the walk-in route ignores the window.
**Why:** Fixed hours do not fit all masseurs; days off are implicit.
**Options:** **A.** Keep global window and per-hour availability. **B.** Per-masseur weekly schedule plus per-hour exceptions. **C.** B plus date-range time off.
**Recommendation: B**, and apply one window rule to every write path.
**Impact:** UI (schedule editor), API (all availability and booking routes), **DB** (schedule table or JSON), existing availability rows unaffected.

### BR-008

**Business question:** May one client hold overlapping or unlimited bookings?
**Current implementation:** No per-client constraint. A client may book unlimited hours in one request, and two masseurs at the same time.
**Why:** Enables abuse (blocking a masseur's day) and accidental double-booking.
**Options:** **A.** No limit. **B.** Block overlapping bookings for the same client and cap slots per request (e.g. 4). **C.** B plus a cap on future pending bookings per client.
**Recommendation: B.**
**Impact:** UI (selection cap and error), API (client create route), optional DB constraint on `clientUserId` (NULL walk-ins excluded), existing data to be checked first.

### BR-009

**Business question:** Must masseurs and clients be notified of bookings and cancellations?
**Current implementation:** No notifications. The masseur sees client name and phone in the calendar; `clientEmail` is unused.
**Why:** Cancellations are invisible to the other party until they open the app.
**Options:** **A.** None. **B.** Email/SMS to masseur on new booking and to client on masseur cancellation. **C.** B plus reminders.
**Recommendation: B.**
**Impact:** new provider integration, API hooks, possibly `Booking`/`User` contact fields; clients register by phone only, so SMS or a collected email is needed.

### BR-010

**Business question:** Which masseurs may clients see and book?
**Current implementation:** Every masseur account is listed, even with no profile, massage types or availability.
**Why:** Clients can open empty or half-configured profiles.
**Options:** **A.** List all. **B.** List only masseurs with required profile fields and at least one future slot. **C.** Explicit "published" toggle.
**Recommendation: B.**
**Impact:** UI (list), `GET /api/masseurs` query, no DB change for B, C needs a flag.

### BR-011

**Business question:** What happens to bookings and personal data when accounts are removed, and how long are cancelled bookings kept?
**Current implementation:** No deletion UI. Cascading delete of masseur data; client deletion nulls `clientUserId`. Cancelled rows are kept indefinitely.
**Why:** Privacy and legal obligations; history integrity.
**Options:** **A.** Hard delete. **B.** Soft delete with anonymisation of personal data, retaining booking history. **C.** Retention period.
**Recommendation: B.**
**Impact:** UI (delete account), API, DB (soft-delete fields / anonymisation job), existing rows unaffected.

### BR-012

**Business question:** Do prices or massage-type-specific durations exist?
**Current implementation:** Neither. Massage type is a label only.
**Options:** **A.** Out of scope. **B.** Optional price per type. **C.** Price and duration per type (depends on BR-001).
**Recommendation: A** until payments or fixed pricing are planned.
**Impact:** A - none. B/C - UI, API, DB (new fields), and booking snapshot of price.

### BR-013

**Business question:** Which countries' phone numbers are accepted?
**Current implementation:** EU countries and Ukraine only (`PHONE_COUNTRIES_EU_UA`), for both clients and walk-ins.
**Options:** **A.** Keep and document. **B.** Allow all valid numbers.
**Recommendation: A** if the launch market is EU + UA; revisit with expansion.
**Impact:** none for A; B changes the phone picker and validation only.

---

## Consistency findings

### Genuine inconsistencies (code vs code)

| ID | Finding | Evidence |
|---|---|---|
| C-1 | **Started-slot rule differs by path.** Client API accepts a slot that started up to 60 min ago; masseur API and resolve route reject any started slot; the client UI hides started slots. | `bookings/route.ts` (`slotStart.getTime() < now - SLOT_MS`) vs `masseur/bookings/route.ts` (`isSlotExpired`) vs `masseurs/[id]/availability/route.ts` (`rangeStart`) |
| C-2 | **Business hours use server-local time on the server and browser-local time in the UI.** If the server timezone differs from users' (likely for UTC hosting; actual deployment timezone **not verified**), the server rejects hours the UI offers (e.g. 05:00-06:59 local) and permits hours the UI hides. | `isWithinBusinessHours` (`getHours`) vs `masseur-availability-calendar.tsx` (`getWeekSlotStarts`) |
| C-3 | **Business hours not enforced everywhere.** Masseur walk-in route and weekly-copy `template` accept any hour, and the walk-in route creates an availability row outside 05:00-23:00. | `masseur/bookings/route.ts`, `masseur/availability/route.ts` (`PUT`) |
| C-4 | **Past-time checks are UI-only for availability edits.** `POST /api/masseur/availability` does not reject started or past hours; the resolve and masseur-booking routes do. | `applySlotChange` |
| C-5 | **Past cancellation asymmetry.** A client can cancel past/ongoing bookings; a masseur cannot. | `bookings/cancel/route.ts` vs `resolve/route.ts` |
| C-6 | **Weekly copy shifts by `setDate(+7)` in server-local time.** Under a DST change the copied slots can move by one hour relative to users' local clock when the server timezone is UTC. | `addWeeks` in `masseur/availability/route.ts` |
| C-7 | **Re-cancelling returns 403 `forbidden`**, not an idempotent success or 404, because a missing, foreign or already-cancelled booking are indistinguishable by design. | `bookings/cancel/route.ts` |
| C-9 | **Masseur email is returned to every client.** `GET /api/masseurs` selects `email` and includes it in the JSON, but the UI never displays it. Whether masseur contact details should be public is an undecided product/privacy question; no `BR` item exists yet (only the code behavior is recorded here). | `src/app/api/masseurs/route.ts` |
| C-8 | **Schema comment drift.** `Booking.clientUserId` is commented "Required for new bookings" but masseur walk-ins create it as `null`. Fields `preferredDate`, `preferredTime`, `clientEmail` are written as `null` and otherwise unused. | `prisma/schema.prisma`, both create routes |

### Checked and consistent

- The DB constraint predicate (`status <> 'cancelled'`, `slotStart IS NOT NULL`) matches every application query that treats a slot as occupied (`status: { not: "cancelled" }`).
- Both creation routes use the lock and map conflicts to `slot_taken` (409).
- The client availability view and the client create route agree on "booked" (non-cancelled booking at the same `slotStart`).
- Zod validation and server checks agree for names, phone, note and massage type; the UI additionally uses native validation helpers.

### Suggested enhancements (not inconsistencies)

Rate limiting on auth and booking endpoints; a stored duration/end on `Booking`; an enum for `status`; booking audit fields (`cancelledAt`, `cancelledBy`); replacing the duplicated `SLOT_MS`/`alignToHour` helpers with one shared module. These are **Proposed** only.

---

## Verification of the working assumptions

| # | Assumption | Verified? | Business requirement or technical choice? |
|---|---|---|---|
| 1 | Sessions last exactly 60 min | Yes - constant in routes, UI and DB | **Technical default**; no approved requirement found ([BR-001](#br-001)) |
| 2 | DB constraint assumes one-hour sessions | Yes - `interval '1 hour'` in the migration | **Technical consequence** of #1 |
| 3 | Only `cancelled` releases a slot | Yes - all queries and the constraint | **Technical**; holds only because no other status exists ([BR-005](#br-005)) |
| 4 | Booking times aligned in server timezone | Yes - `setMinutes(0,0,0)`; business-hours/weekly copy also server-local | **Technical**; harmless for alignment in whole-hour zones, **not** harmless for the hours window ([BR-006](#br-006)) |
| 5 | Separate client and masseur creation endpoints | Yes | **Technical split that encodes different rules** (section 2.2): walk-ins skip the availability requirement and the hours check |
| 6 | Locking plus exclusion constraint for concurrency | Yes - `lockMasseurBookings` and migration `20261115120000_booking_no_overlap` | **Technical** safeguard of the "no double booking" requirement, which is the only clearly intended business rule |
| 7 | Production migration status | **Not verified.** Tested only on local PostgreSQL 16. It is unknown whether production has the migration, `btree_gist`, or overlapping legacy data | Operational, not a business rule |
