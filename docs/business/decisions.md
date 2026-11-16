# Decisions and Findings

> **Status:** working register created from the as-is analysis of `master` at commit `f29ca32` (2026-11-15).
> Nothing in this file is approved until its status says **Approved** or **Implemented**.
> Current as-is behavior is described in [business-rules.md](business-rules.md); approved rules move there (section "Approved rules").

## Workflow

Work is split into two tracks. Every item (a `BR-xxx` decision or a `C-x` inconsistency) goes through them in order.

### Track 1 - documentation (current)

No application code, migration or schema change happens in this track.

1. **Groom** - the options are discussed with the product owner; one is marked *Recommended*.
2. **Approve** - the owner picks an option. The item becomes **Approved**, with the date and the chosen option recorded in the log below.

### Track 2 - implementation (later, separate)

Started only when the owner decides to implement approved items. Each item gets its own branch and pull request.

3. **Groom the implementation** - technical details are confirmed with the owner before any change is made.
4. **Implement** - code, migration (if any) and tests.
5. **Record** - the rule moves into "Approved rules" in [business-rules.md](business-rules.md), with file references, and the item becomes **Implemented**.

| Status | Meaning |
|---|---|
| **Open** | Not yet groomed or decided |
| **Approved** | Option chosen by the owner; not implemented. Not yet binding in "Approved rules" |
| **Implemented** | Merged to `master` and moved to Approved rules |
| **Rejected** | Owner decided to keep current behavior or drop the item |
| **Deferred** | A future idea recorded as a to-do. Not decided, not to be implemented yet |

Suggested order: BR-006 and BR-001 first (they underpin availability maths and the database constraint), then BR-002 / BR-004 / BR-005, then BR-007 / BR-008 / BR-010, then the rest.

## Approved decisions log

| Date | ID | Chosen option | PR |
|---|---|---|---|
| 2026-11-16 | BR-006 | B: per-masseur IANA timezone; clients see masseur time with a label; DST keeps the local clock time | - (not implemented) |
| 2026-11-16 | BR-001 | A: fixed 60-minute sessions (45 min massage + 15 min rest) | - (no code change needed) |
| 2026-11-16 | BR-002 | C: per-masseur client lead time (1/2/3/4 h, default 1 h), strict boundary; masseur walk-ins allowed until slot start | - (not implemented) |
| 2026-11-16 | BR-004 | Per-masseur client cancellation cutoff (1-72 h list, default 24 h), not shorter than the lead time; no grace after booking; masseur phone required and public; payment/fee and notifications excluded; mandatory cancellation reason (dropdown; text required only for "Other") for client cancellations; no cancellation requests; masseur cancellation unchanged | - (not implemented) |
| 2026-11-16 | BR-014 | Thai massage: persistent toast hints when choosing the type, when selecting a slot, and when cancelling one of consecutive slots; no enforcement or grouping | - (not implemented) |

---

## Decision registry

Priority reflects impact on booking correctness, customer experience and availability. **"Recommended" is a proposal, not a decision.**

| ID | Topic | Priority | Recommended (proposal) | Status |
|---|---|---|---|---|
| [BR-001](#br-001) | Session duration | High | A: keep fixed 60 min, document as requirement | **Approved** (2026-11-16) |
| [BR-002](#br-002) | Minimum advance booking / started slots | High | B: single configurable lead time, same on every path (owner chose C: per-masseur setting) | **Approved** (2026-11-16) |
| [BR-003](#br-003) | Maximum advance booking horizon | Medium | B: 90-day booking window | Open |
| [BR-004](#br-004) | Cancellation policy | High | B: client cutoff (e.g. 24 h) + masseur always allowed pre-start (owner chose a per-masseur cutoff) | **Approved** (2026-11-16) |
| [BR-005](#br-005) | Booking statuses and confirmation | High | A for now: stay at `pending`/`cancelled` but rename `pending`->`confirmed`; defer new states | Open |
| [BR-006](#br-006) | Timezone model | High | B: per-masseur IANA timezone | **Approved** (2026-11-16) |
| [BR-007](#br-007) | Working hours and days off | Medium | B: per-masseur hours, keep per-hour exceptions | Open |
| [BR-008](#br-008) | Client double-booking across masseurs and limits | Medium | B: block overlapping own bookings | Open |
| [BR-009](#br-009) | Notifications | Medium | B: email/SMS on booking and cancellation (scope now covers all events; to be groomed as a separate new feature) | Open |
| [BR-010](#br-010) | Masseur discoverability | Medium | B: list only profiles that are complete and have availability | Open |
| [BR-011](#br-011) | Data retention and account deletion | Low | B: soft-delete + anonymise | Open |
| [BR-012](#br-012) | Pricing and per-type duration | Low | A: out of scope for now | Open |
| [BR-013](#br-013) | Supported phone countries | Low | A: keep EU + UA, document it | Open |
| [BR-014](#br-014) | Long sessions (Thai massage) as consecutive slots | Medium | UI toast hints, no enforcement (chosen by the owner) | **Approved** (2026-11-16) |
| [BR-015](#br-015) | Late-cancellation fee (50%) and online payment | Future | A: policy shown before booking, late cancellation flagged, payment settled offline (when picked up) | **Deferred** (2026-11-16) |

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

**Decision (Approved 2026-11-16, not implemented):** **Option A.** Every session is exactly 60 minutes. Rationale from the owner: an average massage lasts about 45 minutes, plus about 15 minutes reserved for rest/turnaround, so each session is priced and scheduled as one 60-minute slot. Longer sessions (e.g. Thai massage) are booked as several consecutive slots; see [BR-014](#br-014). No change to the data model or the exclusion constraint.

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

**Decision (Approved 2026-11-16, not implemented):** **Option C, per-masseur lead time**, with the following rules. The rule comes from a practising masseur.

1. **Masseur walk-ins:** a masseur may book a slot up to its start. A 10:00 slot can be booked until 10:00 (not at or after the start) and appears in the masseur's own calendar as available.
2. **Clients:** a client must book with a lead time. Slots inside the lead-time window are **not shown** to the client and cannot be booked.
3. **Setting:** each masseur sets the lead time in their profile settings in the masseur dashboard. Allowed values: **1, 2, 3 or 4 hours** only (no free input). Default: **1 hour**.
4. **Boundary (strict):** the lead time is measured from the exact start of the slot. A slot starting at `S` is available to clients while `now < S - L`. At `now = S - L` exactly, it is already hidden. Example with L = 1 h: a 10:00 slot is visible at 08:59:59 and hidden at 09:00:00.
5. **Started slots:** a slot that has started is never bookable by a client. The current 60-minute grace in the client booking API (C-1) is removed.

**Resolves when implemented:** C-1 (inconsistent started-slot rule across the client API, masseur API and UI).

**Open sub-questions for track 2 (proposed defaults, not yet confirmed by the owner):** existing masseurs receive the 1-hour default; changing the setting affects only new bookings, existing bookings are unchanged; if the window closes while a client is choosing slots, the server rejects the request (`slot_unavailable`) and the calendar refreshes; the masseur's own calendar still shows slots inside the client window; name and placement of the setting in the dashboard; interaction with the timezone rule of [BR-006](#br-006) (the window is evaluated against the instant, the displayed time is in the masseur's timezone).

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

**Decision (Approved 2026-11-16, not implemented):** a **per-masseur client cancellation cutoff** (stronger than the options above).

1. **Cutoff setting:** each masseur sets, in their dashboard, how long before the session start a client may still cancel. Allowed values (a fixed list, no free input): **1, 2, 3, 4, 6, 8, 12, 24, 36, 48, 72 hours**. Default: **24 hours**.
2. **Client cancellation:** a client may cancel their own booking only while `now <= start - cutoff` of that masseur. After that the client cannot cancel in the application. Sessions that have started or are in the past cannot be cancelled by the client (this follows from the cutoff being at least 1 hour).
3. **Bookings made inside the cutoff window:** they remain non-cancellable by the client from the start. Before confirming such a booking, the client sees a clear notice that cancellation is no longer possible for this slot (stating the masseur's cutoff). There is no grace period after booking.
4. **After the window closes:** the client sees a message that cancellation in the application is no longer possible and the **masseur's phone number**, so the client can contact them. The masseur may still cancel the booking on their side.
5. **Masseur phone:** a **required** field in the masseur profile (validated like other phone numbers) and **visible to any client**. The masseur must be told on the profile form that the number is public to clients. Existing masseurs without a phone are shown without a contact until they add one.
6. **Relation to BR-002:** the cutoff cannot be shorter than the masseur's client lead time. Cutoff options below the lead time are not selectable, so a slot freed by a cancellation can always be booked again by clients. If the lead time is raised above the current cutoff, the cutoff must be raised or the masseur must be warned.
7. **Notification of the masseur** about client cancellations is wanted, but it is **not decided here**: it is part of the separate notifications feature, see [BR-009](#br-009).
8. **Cancellation reason (client cancellations):** when a client cancels, choosing a reason is **mandatory**. The reason is picked from a fixed list: **"I can't make it in time"**, **"My circumstances changed"**, **"I changed my mind"**, **"I chose the time slot by mistake"**, **"Other"**. The reason is chosen in a **dropdown (select)**. The **text field appears only when "Other" is selected, and is then mandatory** (a short free-text reason). For every other option there is **no text field at all** and no comment can be entered. The "Other" text is limited to **200 characters**. The masseur **sees the reason** (and the "Other" text) in the **details of the slot** and in the **notification** they will receive about the cancellation ([BR-009](#br-009)).
9. **No cancellation request flow:** a client cancellation within the allowed window takes effect **immediately**; the masseur does not approve or decline it.
10. **Masseur cancellation is unchanged:** the masseur cancels as implemented today (allowed until the slot starts, with a choice to keep the hour available or remove it). The reason requirement above applies to clients only.

**Not decided / out of scope of this decision:** any fee, penalty or payment for late cancellation (postponed, see [BR-015](#br-015)); a "cancelled by" marker; handling of past bookings and statuses ([BR-005](#br-005)).

**Resolves when implemented:** C-5 (client could cancel past or in-progress bookings, a masseur could not).

**Open sub-questions for track 2 (not yet groomed):** how the masseur's slot details show a cancellation reason, given that today a cancelled booking disappears from the masseur calendar and the hour simply shows as available again (e.g. a "last cancellation" line in the slot details, or a list of recent cancellations); where the reason is stored (new nullable fields on `Booking`, plus a timestamp; the reason list must be translated to English and Ukrainian) and whether existing cancelled bookings keep it empty; how reasons work when several consecutive slots are cancelled one by one ([BR-014](#br-014)); default cutoff for existing masseurs (24 h proposed); what happens to existing future bookings that fall inside a newly chosen cutoff; exact wording of the notice and the post-cutoff message in English and Ukrainian; where the cutoff and phone fields live in the dashboard; whether the post-cutoff message shows the phone as a tap-to-call link; how the phone is collected from existing masseurs; privacy wording shown on the profile form.

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

**Decision (Approved 2026-11-16, not implemented):**

1. **Timezone model:** each masseur has an IANA timezone (e.g. `Europe/Kyiv`). Slots, working hours (currently 05:00-23:00, see BR-007) and "today" are evaluated in the masseur's timezone, independent of the server and of the viewer's browser. Instants stay stored as UTC.
2. **Display to clients:** times are shown in the **masseur's** timezone with a visible label (e.g. "Kyiv, UTC+2").
3. **Daylight saving:** when a masseur copies a week forward, slots keep the same **local clock time** (a 10:00 slot stays 10:00 across a DST change); the stored UTC instant changes accordingly.

**Resolves when implemented:** C-2 (business hours evaluated in server time), C-6 (week copy shifts by +7 days in server time).

**Open sub-questions for track 2 (not yet groomed):** default timezone for existing masseurs; how a masseur sets or changes the timezone (auto-detect vs explicit choice, and whether it may change once bookings exist); what happens to existing and walk-in bookings if the timezone changes; wording and format of the timezone label.

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

**Owner note (2026-11-16):** notifications are to be handled as a **separate new, not yet implemented feature**, and must cover **all relevant events**, not only cancellations. Known requirement so far: the masseur is notified when a client cancels a booking ([BR-004](#br-004)). Channels (email, SMS, in-app), the full list of events, recipients and message content are still to be groomed. Status stays **Open**.

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

### BR-014

**Business question:** How are sessions longer than 60 minutes (e.g. Thai massage) booked, given that [BR-001](#br-001) fixes the slot at 60 minutes?
**Current implementation:** A client may select several hours in one request; each hour becomes an independent booking with no link between them. Nothing knows that Thai massage needs more than one slot, and cancelling one hour leaves the others booked.
**Options considered:** (1) enforce a minimum number of consecutive slots per massage type; (2) UI hint only; (3) group bookings so that they are cancelled together.

**Decision (Approved 2026-11-16, not implemented):** UI hints only, **no enforcement and no grouping**. The client is reminded through toasts; the data model is unchanged and each hour stays an independent booking.

1. **Booking hint.** When the client selects the massage type **Thai** (changing the type to Thai), a toast recommends choosing more than one consecutive slot.
2. **Slot-selection hint.** While the type is Thai, the same toast is shown again after the client selects a slot in the calendar.
3. **Cancellation hint.** When a client cancels one of several consecutive slots and the massage type is Thai, a toast recommends cancelling the neighbouring slot as well, because the massage type is Thai.
4. **Toast behavior.** These toasts are closed **only by the user** (no auto-dismiss).
5. Booking more or fewer slots remains allowed; the toasts are recommendations, not validation.

**Open sub-questions for track 2 (not yet groomed):** whether the toast is suppressed when two or more consecutive slots are already selected; how "consecutive" is detected on cancellation (same masseur, same client, adjacent hour, same type) and whether the toast offers a one-click cancel of the neighbour; whether other massage types may get the same hint later; exact wording in English and Ukrainian; whether the masseur's walk-in flow and the masseur's own cancel flow get the same hints.

**Related:** [BR-001](#br-001), [BR-008](#br-008) (limit on hours per request), [BR-012](#br-012) (per-type duration and price).

### BR-015

**Status: Deferred (2026-11-16). A future to-do, not an approved rule.** Nothing here may be implemented or shown to users yet.

**Idea (from the owner):** a client may cancel free of charge at least 24 hours before the session; a cancellation less than 24 hours before would require the client to pay **50% of the session price**. The "24 hours" is now superseded by the per-masseur cancellation cutoff of [BR-004](#br-004).

**Why deferred:** the application has no prices and no payments (see [BR-012](#br-012)), so the fee cannot be shown, recorded or collected. The owner chose to postpone payment handling and keep it as an ideal future option.

**Options (for when it is picked up):**
- **A.** Policy plus record: the terms are shown before booking, a late cancellation requires explicit confirmation and is flagged on the booking, and the 50% is settled offline between client and masseur. **(Recommended)** - no payment infrastructure, and the flag is useful if online payment comes later.
- **B.** Online payment inside the app: needs a session price, a payment provider, payment and refund handling, payment statuses, contracts and taxes. Most expensive.
- **C.** Text warning only, nothing recorded. Cheapest but nothing proves the client was warned.

**Also to settle then:** where the price lives (per masseur or per massage type), the fee for no-shows ([BR-005](#br-005)), legal wording and the client's consent shown before booking, and how the fee interacts with bookings made inside the cutoff window. Related: [BR-004](#br-004), [BR-012](#br-012), [BR-009](#br-009).


---

## Code inconsistencies

### Genuine inconsistencies (code vs code)

Until each item is groomed and approved, its status stays **Open**. These are defects in the as-is behavior; fixing them still goes through grooming (see workflow above).

| ID | Finding | Evidence | Status |
|---|---|---|---|
| C-1 | **Started-slot rule differs by path.** Client API accepts a slot that started up to 60 min ago; masseur API and resolve route reject any started slot; the client UI hides started slots. | `bookings/route.ts` (`slotStart.getTime() < now - SLOT_MS`) vs `masseur/bookings/route.ts` (`isSlotExpired`) vs `masseurs/[id]/availability/route.ts` (`rangeStart`) | Open |
| C-2 | **Business hours use server-local time on the server and browser-local time in the UI.** If the server timezone differs from users' (likely for UTC hosting; actual deployment timezone **not verified**), the server rejects hours the UI offers (e.g. 05:00-06:59 local) and permits hours the UI hides. | `isWithinBusinessHours` (`getHours`) vs `masseur-availability-calendar.tsx` (`getWeekSlotStarts`) | Open |
| C-3 | **Business hours not enforced everywhere.** Masseur walk-in route and weekly-copy `template` accept any hour, and the walk-in route creates an availability row outside 05:00-23:00. | `masseur/bookings/route.ts`, `masseur/availability/route.ts` (`PUT`) | Open |
| C-4 | **Past-time checks are UI-only for availability edits.** `POST /api/masseur/availability` does not reject started or past hours; the resolve and masseur-booking routes do. | `applySlotChange` | Open |
| C-5 | **Past cancellation asymmetry.** A client can cancel past/ongoing bookings; a masseur cannot. | `bookings/cancel/route.ts` vs `resolve/route.ts` | Open |
| C-6 | **Weekly copy shifts by `setDate(+7)` in server-local time.** Under a DST change the copied slots can move by one hour relative to users' local clock when the server timezone is UTC. | `addWeeks` in `masseur/availability/route.ts` | Open |
| C-7 | **Re-cancelling returns 403 `forbidden`**, not an idempotent success or 404, because a missing, foreign or already-cancelled booking are indistinguishable by design. | `bookings/cancel/route.ts` | Open |
| C-9 | **Masseur email is returned to every client.** `GET /api/masseurs` selects `email` and includes it in the JSON, but the UI never displays it. Whether masseur contact details should be public is an undecided product/privacy question; no `BR` item exists yet (only the code behavior is recorded here). | `src/app/api/masseurs/route.ts` | Open |
| C-8 | **Schema comment drift.** `Booking.clientUserId` is commented "Required for new bookings" but masseur walk-ins create it as `null`. Fields `preferredDate`, `preferredTime`, `clientEmail` are written as `null` and otherwise unused. | `prisma/schema.prisma`, both create routes | Open |

### Checked and consistent

- The DB constraint predicate (`status <> 'cancelled'`, `slotStart IS NOT NULL`) matches every application query that treats a slot as occupied (`status: { not: "cancelled" }`).
- Both creation routes use the lock and map conflicts to `slot_taken` (409).
- The client availability view and the client create route agree on "booked" (non-cancelled booking at the same `slotStart`).
- Zod validation and server checks agree for names, phone, note and massage type; the UI additionally uses native validation helpers.

### Suggested enhancements (not inconsistencies)

Rate limiting on auth and booking endpoints; a stored duration/end on `Booking`; an enum for `status`; booking audit fields (`cancelledAt`, `cancelledBy`); replacing the duplicated `SLOT_MS`/`alignToHour` helpers with one shared module. These are **Proposed** only.

