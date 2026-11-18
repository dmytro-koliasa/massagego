# Decisions and Findings

> **Status:** working register created from the as-is analysis of `master` at commit `f29ca32` (2026-11-15). Track-2 product implementation is **complete through [#20](https://github.com/dmytro-koliasa/massagego/pull/20)** (follow-ups [#25](https://github.com/dmytro-koliasa/massagego/pull/25)–[#28](https://github.com/dmytro-koliasa/massagego/pull/28); ops/CI/E2E [#22](https://github.com/dmytro-koliasa/massagego/pull/22)–[#24](https://github.com/dmytro-koliasa/massagego/pull/24), [#29](https://github.com/dmytro-koliasa/massagego/pull/29)–[#38](https://github.com/dmytro-koliasa/massagego/pull/38)).
> Nothing in this file is approved until its status says **Approved** or **Implemented**.
> Binding implemented rules live in [business-rules.md](business-rules.md) (Approved rules); §§1–9 there are historical as-is notes.
>
> **Data note (owner, 2026-11-16):** the current database holds **test data only** and will be **wiped and refilled** before real use. Track 2 questions about handling or migrating existing data (for example default values for existing masseurs, renaming `pending`, existing clients without a city, cities in excluded countries) are therefore **not blockers**. This note applies to those questions only; schema changes and migrations are still needed, and the production state of the migration `20261115120000_booking_no_overlap` has not been verified (P-1).

## Workflow

Work is split into two tracks. Every item (a `BR-xxx` decision or a `C-x` inconsistency) goes through them in order.

### Track 1 - documentation (done for approved track-2 scope)

No application code, migration or schema change happens in this track.

1. **Groom** - the options are discussed with the product owner; one is marked *Recommended*.
2. **Approve** - the owner picks an option. The item becomes **Approved**, with the date and the chosen option recorded in the log below.

### Track 2 - implementation (product track complete through #20)

Each approved item got its own branch and pull request.

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

Historical suggested order (all shipped): BR-006 and BR-001 first, then BR-002 / BR-004 / BR-005, then BR-007 / BR-008 / BR-010, then the rest.

## Cross-cutting requirements

Requirements from the owner that apply to **every** item, not to a single `BR-xxx`. They are recorded here so they are not forgotten when implementation starts (track 2).

| ID | Requirement | Recorded |
|---|---|---|
| XR-1 | **Privacy and data protection.** When implementing, take into account the **GDPR** and the **other privacy and personal-data regulations that may apply** to the service and its users (the exact set is to be identified, ideally with legal advice). Personal data handling must be designed in, not added afterwards. | 2026-11-16 |

**Rationale and limits of XR-1 for retention (owner, 2026-11-16):** the seven-day deletion of cancelled bookings ([BR-011](#br-011)) is a **product decision to minimise personal data and database size**, not a legal requirement. **National or sector-specific legal exceptions** (for example accounting, tax, consumer-protection or dispute-resolution retention duties) **may apply and need legal review** before release.

Features that already touch personal data and must be reviewed against XR-1 when implemented: the masseur's **public phone number** ([BR-004](#br-004)); **account deletion and retention** ([BR-011](#br-011)); the cancellation reason free text ([BR-004](#br-004)); client and masseur **city** and phone numbers ([BR-013](#br-013), [BR-017](#br-017)); name and phone copied into bookings ([BR-008](#br-008)); **notifications** and the consent for them ([BR-009](#br-009)); any future payment data ([BR-015](#br-015)). Likely needs, to be confirmed with legal advice: privacy policy and terms shown at registration with consent, a way to export and erase one's data, retention periods, and consent for cookies or tracking if used. This is a requirement to design for, not a legal opinion.

## Approved decisions log

| Date | ID | Chosen option | PR |
|---|---|---|---|
| 2026-11-16 | BR-006 | B: per-masseur IANA timezone; clients see masseur time with a label; DST keeps the local clock time | [#5](https://github.com/dmytro-koliasa/massagego/pull/5) (server); [#6](https://github.com/dmytro-koliasa/massagego/pull/6) (calendars); choosing the zone in PR 8 |
| 2026-11-16 | BR-001 | A: fixed 60-minute sessions (45 min massage + 15 min rest) | [#5](https://github.com/dmytro-koliasa/massagego/pull/5) (one shared constant) |
| 2026-11-16 | BR-002 | C: per-masseur client lead time (1/2/3/4 h, default 1 h), strict boundary; masseur walk-ins allowed until slot start | [#8](https://github.com/dmytro-koliasa/massagego/pull/8) |
| 2026-11-16 | BR-004 | Per-masseur client cancellation cutoff (1-72 h list, default 24 h), not shorter than the lead time; no grace after booking; masseur phone required and public; payment/fee and notifications excluded; mandatory cancellation reason (dropdown; text required only for "Other") for client cancellations; no cancellation requests; masseur cancellation unchanged | settings [#8](https://github.com/dmytro-koliasa/massagego/pull/8); cancel + reason [#9](https://github.com/dmytro-koliasa/massagego/pull/9) |
| 2026-11-17 | BR-004 | Masseur slot details: `lastCancellation` on availability (latest client cancel per hour within 7 days); EN/UK labels including `client_account_deleted` | [#25](https://github.com/dmytro-koliasa/massagego/pull/25) |
| 2026-11-16 | BR-005 | A: no masseur confirmation, `pending` renamed to `confirmed`; no post-session statuses (time-derived); `cancelledBy` and `cancelledAt` stored on cancelled bookings | [#4](https://github.com/dmytro-koliasa/massagego/pull/4) (implemented) |
| 2026-11-16 | BR-007 | A: global 05:00-23:00 window (masseur timezone) enforced on every write path; no explicit days off; server rejects past availability edits | [#7](https://github.com/dmytro-koliasa/massagego/pull/7) (implemented) |
| 2026-11-16 | BR-008 | B: no overlapping active bookings per client; max 30 active future bookings per client; no separate per-request limit; client bookings take name (main registration name) and phone from the account, not from the request | [#9](https://github.com/dmytro-koliasa/massagego/pull/9) |
| 2026-11-16 | BR-009 | Notifications: email main, optional Telegram; events 1-5 (new booking, client cancel, masseur cancel, auto-cancel on client deletion, confirmation); per-event per-channel settings with at least one channel on for critical events; verified email; language from account; informative content without phones; retry for a day | email [#17](https://github.com/dmytro-koliasa/massagego/pull/17); Telegram [#18](https://github.com/dmytro-koliasa/massagego/pull/18); event 4 [#19](https://github.com/dmytro-koliasa/massagego/pull/19) |
| 2026-11-17 | BR-009 | Client session reminder (`booking_reminder`); masseur Off/2/4/12/24 h; cron + `reminderSentAt` | [#27](https://github.com/dmytro-koliasa/massagego/pull/27) |
| 2026-11-16 | BR-023 | Optional phone confirmation through the Telegram bot ("phone confirmed" mark); not required to register or book | [#18](https://github.com/dmytro-koliasa/massagego/pull/18) |
| 2026-11-16 | BR-022 | Check the real content of uploaded images, compute dimensions on the server, re-save without metadata (GPS) | [#14](https://github.com/dmytro-koliasa/massagego/pull/14) |
| 2026-11-16 | BR-021 | Minimal administration panel: user list, block and unblock; complaints added later | [#20](https://github.com/dmytro-koliasa/massagego/pull/20); complaints [#26](https://github.com/dmytro-koliasa/massagego/pull/26) |
| 2026-11-17 | BR-021 | Complaints: client↔masseur via booking; categories; admin inbox + note; rate limit 5/h | [#26](https://github.com/dmytro-koliasa/massagego/pull/26) |
| 2026-11-16 | BR-020 | Basic rate limits per IP and per account on sign-in, registration, password reset, booking creation and cancellation | [#13](https://github.com/dmytro-koliasa/massagego/pull/13) |
| 2026-11-16 | BR-019 | Password reset by a one-time email link for both roles; the client keeps signing in by phone and password only | [#13](https://github.com/dmytro-koliasa/massagego/pull/13) |
| 2026-11-16 | BR-018 | C: completed bookings hard-deleted 3 months after the session unless financial or legal obligations exist (extendable to payments) | [#19](https://github.com/dmytro-koliasa/massagego/pull/19) |
| 2026-11-16 | BR-011 | Self-service anonymising account deletion; client deletion auto-cancels future bookings, masseur deletion blocked while future bookings exist; cancelled bookings without obligations hard-deleted 7 days after cancellation; completed-booking retention left to BR-018 | [#19](https://github.com/dmytro-koliasa/massagego/pull/19) |
| 2026-11-16 | BR-013 | B with exclusions: any valid international phone except African countries, Russia and Belarus; the same single shared blocklist also removes those countries from the city search | [#11](https://github.com/dmytro-koliasa/massagego/pull/11) |
| 2026-11-16 | BR-003 | B: fixed 120-day booking window for clients, same for every masseur | [#8](https://github.com/dmytro-koliasa/massagego/pull/8) |
| 2026-11-16 | BR-017 | A: client chooses a city at registration (required, editable in profile); the masseur list defaults to the client's city | [#12](https://github.com/dmytro-koliasa/massagego/pull/12) |
| 2026-11-16 | BR-010 | Listed: complete profile and at least one availability record ever; green/red card label with nearest free time; free-time masseurs first, then newest; unlisted profiles open by link but cannot be booked; masseur email removed from the list API | [#16](https://github.com/dmytro-koliasa/massagego/pull/16) |
| 2026-11-16 | BR-014 | Thai massage: persistent toast hints when choosing the type, when selecting a slot, and when cancelling one of consecutive slots; no enforcement or grouping | [#10](https://github.com/dmytro-koliasa/massagego/pull/10) |
| 2026-11-16 | C-8 | A: remove `preferredDate`, `preferredTime`, `clientEmail`; correct the `clientUserId` comment | [#4](https://github.com/dmytro-koliasa/massagego/pull/4) (implemented) |
| 2026-11-16 | BR-005, BR-004, C-8 (implementation details) | Database enums for status, `cancelledBy` and the cancellation reason; reason keys `cant_make_it`, `circumstances_changed`, `changed_mind`, `wrong_slot`, `other`, `client_account_deleted`; "Other" text `VARCHAR(200)`; no consistency `CHECK`; the reason is not accepted by the API until PR 5 of the plan; indexes on (`status`, `cancelledAt`) and (`status`, `slotStart`); existing non-cancelled rows become `confirmed`, existing cancelled rows get `cancelledAt` = `updatedAt` and an empty `cancelledBy`; the one-off `scripts/migrate-sqlite-to-postgres.js` is removed | [#4](https://github.com/dmytro-koliasa/massagego/pull/4) |
| 2026-11-16 | BR-006, BR-001 (implementation details) | `User.timezone` (IANA name, default `Europe/Kyiv`, validated with a fallback to the default), no UI to choose it until PR 8 (where X-2 is groomed); time-zone maths with the `luxon` library; the three calendars move to the masseur's zone in a new PR 2a (inserted into the plan); label format "Kyiv, UTC+2" from the IANA city and the offset of the shown instant, the same in both languages | [#5](https://github.com/dmytro-koliasa/massagego/pull/5) |
| 2026-11-16 | BR-006 (calendars, PR 2a) | Masseur and client booking calendars render in the masseur's zone with FullCalendar `@fullcalendar/luxon3` and the line "Times in {label}" / "Час: {label}"; client sessions calendar stays in the browser zone with a per-event masseur-zone label; `timezone` added to availability and bookings API responses; no device-vs-profile warning until PR 8 | [#6](https://github.com/dmytro-koliasa/massagego/pull/6) |

---

## Decision registry

Priority reflects impact on booking correctness, customer experience and availability. **"Recommended" is a proposal, not a decision.**

| ID | Topic | Priority | Recommended (proposal) | Status |
|---|---|---|---|---|
| [BR-001](#br-001) | Session duration | High | A: keep fixed 60 min, document as requirement | **Implemented** ([#5](https://github.com/dmytro-koliasa/massagego/pull/5)) |
| [BR-002](#br-002) | Minimum advance booking / started slots | High | B: single configurable lead time, same on every path (owner chose C: per-masseur setting) | **Implemented** ([#8](https://github.com/dmytro-koliasa/massagego/pull/8)) |
| [BR-003](#br-003) | Maximum advance booking horizon | Medium | B: fixed booking window (owner chose 120 days) | **Implemented** ([#8](https://github.com/dmytro-koliasa/massagego/pull/8)) |
| [BR-004](#br-004) | Cancellation policy | High | B: client cutoff (e.g. 24 h) + masseur always allowed pre-start (owner chose a per-masseur cutoff) | **Implemented** ([#8](https://github.com/dmytro-koliasa/massagego/pull/8), [#9](https://github.com/dmytro-koliasa/massagego/pull/9)) |
| [BR-005](#br-005) | Booking statuses and confirmation | High | A for now: stay at `pending`/`cancelled` but rename `pending`->`confirmed`; defer new states | **Implemented** ([#4](https://github.com/dmytro-koliasa/massagego/pull/4)) |
| [BR-006](#br-006) | Timezone model | High | B: per-masseur IANA timezone | **Implemented** ([#5](https://github.com/dmytro-koliasa/massagego/pull/5), [#6](https://github.com/dmytro-koliasa/massagego/pull/6), [#12](https://github.com/dmytro-koliasa/massagego/pull/12)) |
| [BR-007](#br-007) | Working hours and days off | Medium | B: per-masseur hours, keep per-hour exceptions (owner chose a global window, see decision) | **Implemented** ([#7](https://github.com/dmytro-koliasa/massagego/pull/7)) |
| [BR-008](#br-008) | Client double-booking across masseurs and limits | Medium | B: block overlapping own bookings (plus a cap on active future bookings) | **Implemented** ([#9](https://github.com/dmytro-koliasa/massagego/pull/9)) |
| [BR-009](#br-009) | Notifications | Medium | B: email/SMS on booking and cancellation (owner chose email main + optional Telegram, a defined first set of events) | **Implemented** ([#17](https://github.com/dmytro-koliasa/massagego/pull/17), [#18](https://github.com/dmytro-koliasa/massagego/pull/18), [#19](https://github.com/dmytro-koliasa/massagego/pull/19)) |
| [BR-010](#br-010) | Masseur discoverability | Medium | B: list only profiles that are complete and have availability (owner chose a variant, see decision) | **Implemented** ([#16](https://github.com/dmytro-koliasa/massagego/pull/16)) |
| [BR-011](#br-011) | Data retention and account deletion | Low | B: soft-delete + anonymise (owner: self-service anonymising deletion; cancelled bookings hard-deleted after 7 days) | **Implemented** ([#19](https://github.com/dmytro-koliasa/massagego/pull/19)); completed retention via [BR-018](#br-018) |
| [BR-018](#br-018) | Retention of completed (held) bookings | Medium | C: hard delete after a fixed period unless obligations exist (owner chose 3 months) | **Implemented** ([#19](https://github.com/dmytro-koliasa/massagego/pull/19)) |
| [BR-019](#br-019) | Password reset and account recovery | Medium | A: email link; client signs in by phone only | **Implemented** ([#13](https://github.com/dmytro-koliasa/massagego/pull/13)) |
| [BR-020](#br-020) | Abuse protection (rate limiting) | Medium | A: basic limits per IP and per account | **Implemented** ([#13](https://github.com/dmytro-koliasa/massagego/pull/13)) |
| [BR-021](#br-021) | Administrator or support role | Low | A: no admin role for now (owner chose a minimal admin panel) | **Implemented** ([#20](https://github.com/dmytro-koliasa/massagego/pull/20)); complaints [#26](https://github.com/dmytro-koliasa/massagego/pull/26) |
| [BR-022](#br-022) | Image upload rules | Low | A: check real content, compute size, re-save without metadata | **Implemented** ([#14](https://github.com/dmytro-koliasa/massagego/pull/14)) |
| [BR-023](#br-023) | Phone number verification | Low | A: no verification for now (owner chose optional confirmation through the Telegram bot) | **Implemented** ([#18](https://github.com/dmytro-koliasa/massagego/pull/18)) |
| [BR-012](#br-012) | Pricing and per-type duration | Low | A: out of scope for now | **Deferred** (2026-11-16) |
| [BR-013](#br-013) | Supported phone countries | Low | A: keep EU + UA, document it (owner chose all countries except an excluded list) | **Implemented** ([#11](https://github.com/dmytro-koliasa/massagego/pull/11)) |
| [BR-014](#br-014) | Long sessions (Thai massage) as consecutive slots | Medium | UI toast hints, no enforcement (chosen by the owner) | **Implemented** ([#10](https://github.com/dmytro-koliasa/massagego/pull/10)) |
| [BR-015](#br-015) | Late-cancellation fee (50%) and online payment | Future | A: policy shown before booking, late cancellation flagged, payment settled offline (when picked up) | **Deferred** (2026-11-16) |
| [BR-016](#br-016) | Massage courses (packages of 10-20 sessions) | Future | - (no recommendation yet) | **Deferred** (2026-11-16) |
| [BR-017](#br-017) | Client city and default city filter | Medium | A: city required at client registration; list defaults to it | **Implemented** ([#12](https://github.com/dmytro-koliasa/massagego/pull/12)) |

### BR-001

**Business question:** Are all sessions exactly 60 minutes, or should masseurs offer 30/90/120-minute sessions?
**Baseline (pre track-2):** Fixed 60 min everywhere (`SLOT_MS`, calendars, constraint). `Booking` has no duration field.
**Why a decision is needed:** Real massage services vary in length. The DB constraint and data model cannot represent anything else without a migration.
**Options:**
- **A.** Keep 60 min fixed; document as a product rule.
- **B.** Per-masseur fixed session length (e.g. 60 or 90).
- **C.** Per-booking duration chosen from massage type.
**Recommendation: A** for now: it is the cheapest, consistent with the existing UI, and avoids data-model changes until demand is proven. Revisit before onboarding masseurs who need other lengths.
**Impact:** A - docs only. B/C - UI (calendar slot size, multi-hour selection), API (duration param, availability generation), **DB (new `durationMinutes`/`slotEnd` column and a replacement exclusion constraint on a stored end)**, and backfill of existing rows to 60.

**Decision (Approved 2026-11-16):** **Option A.** Every session is exactly 60 minutes. Rationale from the owner: an average massage lasts about 45 minutes, plus about 15 minutes reserved for rest/turnaround, so each session is priced and scheduled as one 60-minute slot. Longer sessions (e.g. Thai massage) are booked as several consecutive slots; see [BR-014](#br-014). No change to the data model or the exclusion constraint.

**Implemented (2026-11-16, [#5](https://github.com/dmytro-koliasa/massagego/pull/5)):** the session length is one shared constant (`SESSION_MINUTES`, `SLOT_MS` in `src/lib/booking-constants.ts`) used by the routes and the calendars; the duplicated copies are removed. The exclusion constraint still hard-codes `interval '1 hour'` in SQL and must change together with the constant.

### BR-002

**Business question:** How far in advance must a booking be made, and may a client book an hour that has already started?
**Baseline (pre track-2):** Client API accepts starts up to 60 min in the past; masseur API rejects any started slot; the client UI hides started slots.
**Why:** Inconsistent across paths (C-1); no minimum lead time, so a client can book the next minute.
**Options:**
- **A.** Reject any started slot on every path; no lead time.
- **B.** One configurable minimum lead time (e.g. 2 h) applied to client bookings; masseur walk-ins exempt or allowed up to start.
- **C.** Per-masseur lead time.
**Recommendation: B**, defaulting to a small value, with the same "started slot" rule on all paths.
**Impact:** UI (hide/disable slots inside the window), API (both create routes), no DB change, no data migration.

**Decision (Implemented in PR 4):** **Option C, per-masseur lead time**, with the following rules. The rule comes from a practising masseur.

1. **Masseur walk-ins:** a masseur may book a slot up to its start. A 10:00 slot can be booked until 10:00 (not at or after the start) and appears in the masseur's own calendar as available.
2. **Clients:** a client must book with a lead time. Slots inside the lead-time window are **not shown** to the client and cannot be booked.
3. **Setting:** each masseur sets the lead time in their profile settings in the masseur dashboard. Allowed values: **1, 2, 3 or 4 hours** only (no free input). Default: **1 hour**.
4. **Boundary (strict):** the lead time is measured from the exact start of the slot. A slot starting at `S` is available to clients while `now < S - L`. At `now = S - L` exactly, it is already hidden. Example with L = 1 h: a 10:00 slot is visible at 08:59:59 and hidden at 09:00:00.
5. **Started slots:** a slot that has started is never bookable by a client. The current 60-minute grace in the client booking API (C-1) is removed.

**Resolves when implemented:** C-1 (inconsistent started-slot rule across the client API, masseur API and UI).

**Implementation (PR 4):** `User.bookingLeadHours` (1/2/3/4, default 1); settings on the masseur dashboard; client availability and booking use a strict boundary with error `BOOKING_LEAD_TIME`; the 60-minute grace is removed; existing bookings are unchanged when the setting changes.

### BR-003

**Business question:** How far into the future can a client book?
**Baseline (pre track-2):** No limit; availability can exist up to 52 weeks ahead.
**Why:** Unbounded horizon increases no-shows and stale availability.
**Options:** **A.** No limit. **B.** Fixed window (e.g. 90 days). **C.** Per-masseur horizon.
**Recommendation: B.**
**Impact:** UI (limit calendar navigation), API (validate in create route and availability GET), no DB change.

**Decision (Implemented in PR 4):** **Option B with a window of 120 days** (instead of the suggested 90).

1. **Booking horizon:** a client can see and book slots only up to **120 days from today**, the same for every masseur. The client calendar cannot be paged forward beyond that, and the server rejects bookings and availability requests beyond it.
2. **The window is not per masseur:** there is no setting for it.
3. **Related:** the "nearest free time" on the masseur card ([BR-010](#br-010)) is computed within this window; the 30-booking cap ([BR-008](#br-008)) and courses of up to 20 sessions fit inside it.
4. **Weekly copy is capped at the horizon:** the masseur's bulk "copy week forward" is limited to about **17 weeks** (the 120-day window) instead of today's 52 (default stays 12). Individual edits are not capped (see 6).
5. **Window boundary by calendar date:** the window ends at the end of the day "today + 120 days", counted in the **masseur's timezone** ([BR-006](#br-006)). Whole days are visible; the boundary does not move during the day.
6. **The masseur is not restricted:** the masseur sees and may edit any date, and may take walk-in bookings beyond the window. Slots beyond the window are marked in the masseur calendar as **"not yet visible to clients"**.
7. **Client message and navigation:** the "forward" button in the client calendar is disabled on the last week of the window, with a hint next to it. If a request still goes beyond the window (an old tab, a direct call), the server rejects it with a clear error and the interface shows the same message. Proposed text: Ukrainian "Запис доступний не більше ніж на 120 днів уперед — до {дата}."; English "Booking is available up to 120 days ahead — until {date}."

**Implementation (PR 4):** weekly copy max **17**; error `BOOKING_WINDOW_EXCEEDED`; masseur calendar dims beyond-window slots and shows "Not yet visible to clients" / "Ще не видно клієнтам" in slot details; slots beyond the window are only hidden from clients, not deleted; client forward nav disabled on the last week with the BR-003 message.

### BR-004

**Business question:** When may a booking be cancelled, by whom, and are there consequences?
**Baseline (pre track-2):** Clients can cancel at any time, including past/ongoing sessions. Masseurs can cancel only before the slot starts. No notice, reason, fee or notification.
**Why:** A client can erase a past booking, which damages the masseur's history; late cancellations have no policy.
**Options:**
- **A.** Keep as is.
- **B.** Client cancellation only until a cutoff before start (e.g. 24 h); masseur may cancel until start; past bookings cannot be cancelled by anyone.
- **C.** B plus a recorded reason and a late-cancel flag.
**Recommendation: B**, as the minimum fix; C once reporting is needed.
**Impact:** UI (disable cancel inside the cutoff), API (`/api/bookings/cancel` time check), DB (none for B; a nullable `cancelledBy`/`cancelReason` for C), existing data unaffected.

**Decision (Approved 2026-11-16; settings Implemented in PR 4, cancel flow in PR 5):** a **per-masseur client cancellation cutoff** (stronger than the options above).

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

**Storage and enforcement (Implemented):** `Booking.cancelReason` is the enum `CancellationReason` with the keys `cant_make_it`, `circumstances_changed`, `changed_mind`, `wrong_slot`, `other` and the system key `client_account_deleted` ([BR-011](#br-011)); the "Other" text is `Booking.cancelReasonText` (`VARCHAR(200)`). Only keys are stored; the English and Ukrainian labels belong to the UI. Client cancel API and UI require a reason; cutoff and lead-time rules are enforced ([#4](https://github.com/dmytro-koliasa/massagego/pull/4), [#8](https://github.com/dmytro-koliasa/massagego/pull/8), [#9](https://github.com/dmytro-koliasa/massagego/pull/9)).

**Masseur slot details (Implemented):** `GET /api/masseur/availability` attaches `lastCancellation` (reason, reasonText, cancelledAt) per slot — the latest **client** cancellation for that `slotStart` with `cancelledAt` inside the 7-day retention window; masseur cancellations (no reason) are omitted. The masseur calendar slot modal shows a "Last cancellation" line on free and booked hours. Consecutive cancelled hours each carry their own last cancellation. Existing cancelled rows without a reason stay empty in the UI.

**Recent cancellations list (Implemented, [#28](https://github.com/dmytro-koliasa/massagego/pull/28)):** masseur dashboard section lists up to 20 client cancellations from the last 7 days (slot time, client name, reason); read-only, no jump-to-calendar.

**Open sub-questions for track 2:** none remaining (defaults and cutoff/phone copy shipped in [#8](https://github.com/dmytro-koliasa/massagego/pull/8)/[#9](https://github.com/dmytro-koliasa/massagego/pull/9); legal copy review stays under P-2).

### BR-005

**Business question:** Does a booking need masseur confirmation, and are `completed` / `no_show` states needed?
**Baseline (pre track-2):** Only `pending` (set at creation, never advanced) and `cancelled`. `status` is a free string.
**Why:** `pending` implies an approval step that does not exist; the UI shows bookings as booked/occupied immediately, i.e. effectively confirmed.
**Options:**
- **A.** Treat creation as confirmation: keep two states but give `pending` an accurate name.
- **B.** Add masseur confirm/decline (real `pending` -> `confirmed`/`declined`).
- **C.** Add post-session states (`completed`, `no_show`).
**Recommendation: A now**, B/C only if the product needs approval or reporting. Whichever is chosen, constrain `status` to an enum.
**Impact:** UI labels; API; **DB** (rename or enum migration, and the exclusion constraint's `<> 'cancelled'` predicate must be reviewed for any new releasing state such as `declined`).

**Decision (Approved 2026-11-16):**

1. **No confirmation by the masseur (option A).** A booking is valid as soon as it is created. The status `pending` is renamed to **`confirmed`**; the only statuses are **`confirmed`** and **`cancelled`**. There is no confirm/decline flow, no "awaiting approval" state and no per-masseur confirmation setting. A masseur who does not want a booking cancels it (rules in [BR-004](#br-004)).
2. **No post-session statuses (option A).** There are no `completed` or `no_show` statuses. Whether a session took place is derived from time: a `confirmed` booking whose session time has passed is a past (held) session. Past bookings cannot be cancelled by the client ([BR-004](#br-004)). Tracking no-shows can be reconsidered together with [BR-015](#br-015) (late-cancellation fee) or reporting.
3. **Cancellation data (option A).** A cancelled booking records **who cancelled** (`cancelledBy`: client or masseur) and **when** (`cancelledAt`), in addition to the client's cancellation reason from [BR-004](#br-004). A full event log is not introduced.

**Implementation (2026-11-16, [#4](https://github.com/dmytro-koliasa/massagego/pull/4)):** the sub-questions were groomed with the owner as follows.

1. `Booking.status` is the PostgreSQL enum `BookingStatus` (`confirmed`, `cancelled`), default `confirmed`. Both creation routes write `confirmed`; `GET /api/bookings` now returns `confirmed`. The UI never showed the word "pending", so no label changed.
2. `cancelledBy` is the enum `CancelledBy` (`client`, `masseur`) and `cancelledAt` a timestamp, both nullable. The client cancel route writes `client`, the masseur resolve route writes `masseur`, and both write `cancelledAt`. Storing the canceller's user id was rejected (unnecessary personal data, XR-1).
3. Migration of existing rows: every non-cancelled row became `confirmed` (all of them occupied the hour before). Existing cancelled rows got `cancelledAt` = `updatedAt` (cancelling was the only update in the code), so they fall under the 7-day deletion of [BR-011](#br-011); `cancelledBy` stays empty because it is unknown. This replaces the earlier proposal to leave both fields empty.
4. The exclusion constraint `Booking_no_overlapping_active_slots` was recreated with the same predicate (`status <> 'cancelled'`) on the enum column. It must be reviewed whenever a value is added to `BookingStatus` (noted in `prisma/schema.prisma`).

**Resolved:** the misleading `pending` name and the free-text `status` field.

### BR-006

**Business question:** In which timezone are working hours, slots and "today" defined?
**Baseline (pre track-2):** UTC storage, browser-local display, server-local alignment and business-hours check (C-2, C-6).
**Why:** Behavior depends on the hosting server's timezone and on each viewer's browser; this directly affects availability correctness.
**Options:** **A.** Assume one fixed timezone (Europe/Kyiv) everywhere. **B.** Store an IANA timezone per masseur; compute hours and display in it. **C.** Keep browser-local.
**Recommendation: B** (A is acceptable as a stopgap if all masseurs are in one zone).
**Impact:** UI (render calendars in masseur tz and say so), API (hour validation and weekly copy in that tz), **DB** (new `User.timezone`), existing data needs a default timezone.

**Decision (Approved 2026-11-16):**

1. **Timezone model:** each masseur has an IANA timezone (e.g. `Europe/Kyiv`). Slots, working hours (currently 05:00-23:00, see BR-007) and "today" are evaluated in the masseur's timezone, independent of the server and of the viewer's browser. Instants stay stored as UTC.
2. **Display to clients:** times are shown in the **masseur's** timezone with a visible label (e.g. "Kyiv, UTC+2").
3. **Daylight saving:** when a masseur copies a week forward, slots keep the same **local clock time** (a 10:00 slot stays 10:00 across a DST change); the stored UTC instant changes accordingly.

**Resolves when implemented:** C-2 (business hours evaluated in server time), C-6 (week copy shifts by +7 days in server time).

**Implementation, server side (2026-11-16, [#5](https://github.com/dmytro-koliasa/massagego/pull/5)):**

1. `User.timezone` holds the masseur's IANA zone, default **`Europe/Kyiv`** for every existing and new masseur. An invalid stored value falls back to the default.
2. Hour alignment, the 05:00-23:00 check and the weekly copy in the booking, cancellation and availability routes are evaluated in the masseur's zone with `luxon` (`src/lib/masseur-time.ts`). The weekly copy keeps the local clock time across daylight-saving changes. No route uses the server's local time any more.
3. Helpers exist for "today" in the masseur's zone and for the label **"Kyiv, UTC+2"**: the city part of the IANA name and the offset of the shown instant (UTC+3 in summer), the same in English and Ukrainian.

**Implementation, calendars (2026-11-16, [#6](https://github.com/dmytro-koliasa/massagego/pull/6)):**

1. The masseur availability calendar and the client booking calendar render in the masseur's IANA zone (`@fullcalendar/luxon3`) with the line **Times in {label}** / **Час: {label}** next to the week title.
2. The client sessions calendar stays in the browser's zone (one grid for many masseurs); each event shows the masseur's zone label.
3. `timezone` is returned by `GET /api/masseur/availability`, `GET /api/masseurs/[id]/availability` and on each masseur in `GET /api/bookings`.
4. A warning when the device zone differs from the profile is deferred to **PR 8**, together with choosing the zone.

**Timezone UI (PR 8):** masseur can set IANA timezone in the profile; choosing a city suggests a zone via `geo-tz` (confirmable); change is always allowed (UTC instants unchanged); device≠profile warning is shown.

**Open sub-questions (for plan PR 8):** resolved in [#12](https://github.com/dmytro-koliasa/massagego/pull/12) (timezone editable with geo-tz suggestion + device mismatch warning; existing bookings keep stored UTC instants).

### BR-007

**Business question:** Can masseurs set their own working hours, days off and holidays?
**Baseline (pre track-2):** Global 05:00-23:00; no days-off concept; availability set per hour; weekly copy as a shortcut; the walk-in route ignores the window.
**Why:** Fixed hours do not fit all masseurs; days off are implicit.
**Options:** **A.** Keep global window and per-hour availability. **B.** Per-masseur weekly schedule plus per-hour exceptions. **C.** B plus date-range time off.
**Recommendation: B**, and apply one window rule to every write path.
**Impact:** UI (schedule editor), API (all availability and booking routes), **DB** (schedule table or JSON), existing availability rows unaffected.

**Decision (Approved 2026-11-16):**

1. **Working hours (option A):** one **global** window **05:00-23:00** for all masseurs (the last slot starts at 22:00). It is not configurable per masseur and there is no weekly schedule. It is evaluated in the **masseur's timezone** ([BR-006](#br-006)).
2. **Enforced on every write path:** the window applies to manual availability changes, to the weekly copy (including a client-supplied template) and to the masseur's walk-in bookings. A slot outside the window cannot be created by any of them.
3. **Days off (option A):** there is no explicit days-off, vacation or time-off concept. A day is off simply because no availability slots exist for it. No "close dates" action and no stored time-off periods are introduced now.
4. **Past edits (option A):** the server rejects any availability change (add or remove) for a slot whose hour has already started, in line with the existing UI and the other booking routes.

**Implementation (2026-11-16, [#7](https://github.com/dmytro-koliasa/massagego/pull/7)):**

1. Error codes: outside the window → `out_of_hours` (400) on every write path; a started availability edit → `slot_in_past` (409). Masseur walk-in / resolve for a started slot stay on `slot_unavailable` (409).
2. Existing out-of-window availability rows are left as they are (test data; none expected). Only new writes are rejected.
3. "Close dates / time off" stays out of scope.

**Resolved:** C-3 and C-4.

### BR-008

**Business question:** May one client hold overlapping or unlimited bookings?
**Baseline (pre track-2):** No per-client constraint. A client may book unlimited hours in one request, and two masseurs at the same time.
**Why:** Enables abuse (blocking a masseur's day) and accidental double-booking.
**Options:** **A.** No limit. **B.** Block overlapping bookings for the same client and cap slots per request (e.g. 4). **C.** B plus a cap on future pending bookings per client.
**Recommendation: B.**
**Impact:** UI (selection cap and error), API (client create route), optional DB constraint on `clientUserId` (NULL walk-ins excluded), existing data to be checked first.

**Decision (Approved 2026-11-16):**

1. **No overlapping bookings per client (option B):** one client account cannot hold two active (`confirmed`) bookings for the same hour, with the same or with different masseurs. Consequence accepted by the owner: booking another person, or a couple, in the same hour through one account is not possible; a second person needs their own account. Masseur walk-in bookings (no client account) are not affected.
2. **Limit on active future bookings: 30 per client.** Only `confirmed` bookings whose session has not yet started count; past and cancelled bookings do not. The cap exists because massage is sold in **courses of 10-15, at most 20 sessions**, so a low limit would get in the way. A request that would take the client above 30 is rejected as a whole.
3. **No separate limit per request:** the only cap is the total of 30. A course can be booked in one request.
4. **Client name and phone come from the account (option A):** for a booking made by a client, the server takes the **client's name and phone from the account** and ignores any `clientName` / `clientPhone` sent in the request; the booking form shows them but does not let the client edit them. The name used is the **main name entered at registration** (not the English/Ukrainian profile variants). The phone is the account's phone (it is the login and is not editable in the profile). The values are **copied into the booking at the time of booking**: a later name change affects new bookings only, existing bookings keep their name. **Masseur walk-in bookings are unchanged:** the masseur still enters the walk-in client's name and phone by hand.

**Open sub-questions for track 2:** none remaining — codes `CLIENT_SLOT_OVERLAP` / `CLIENT_BOOKING_LIMIT`, client exclusion constraint, and constant cap of 30 shipped in [#9](https://github.com/dmytro-koliasa/massagego/pull/9).

### BR-009

**Business question:** Must masseurs and clients be notified of bookings and cancellations?
**Baseline (pre track-2):** No notifications. The masseur sees client name and phone in the calendar; `clientEmail` is unused.
**Why:** Cancellations are invisible to the other party until they open the app.
**Options:** **A.** None. **B.** Email/SMS to masseur on new booking and to client on masseur cancellation. **C.** B plus reminders.
**Recommendation: B.**
**Impact:** new provider integration, API hooks, possibly `Booking`/`User` contact fields; clients register by phone only, so SMS or a collected email is needed.

**Owner note (2026-11-16, historical):** notifications were to cover **all relevant events**, not only cancellations (starting from the masseur notice when a client cancels, [BR-004](#br-004)). First-version channels, events and prefs were groomed below and **Implemented** (see Status). Remaining product open items: optional **in-app notification list**; production Resend domain/sender (P-3); Telegram webhook on a public host (P-4).

**Decisions (groomed; first version Implemented):**

1. **Channels (2026-11-16, option C):** **email is the main channel for both sides**, and users may **optionally connect Telegram** to receive the same events instantly. Email is the guaranteed fallback. WhatsApp, Viber and SMS are not part of this decision and may be considered later (they are paid and need business approval).
2. **Consequences:** the **client** must give a **real email address at registration** (today the stored email is synthesised from the phone); the masseur already has an email. Connecting Telegram is voluntary and consent-based (the user starts the bot from a link in the app); a Telegram bot cannot write first. Using Telegram and an email provider means personal data goes to external processors, to be covered in the privacy policy and consent (XR-1).
3. **Events in the first version (2026-11-16, option A):** (1) a client creates a booking, to the masseur; (2) a client cancels a booking, to the masseur, with the reason ([BR-004](#br-004)); (3) a masseur cancels a booking, to the client; (4) a booking is cancelled automatically because the client deleted the account ([BR-011](#br-011)), to the masseur; (5) a booking confirmation with the session details, to the client. A masseur's own walk-in booking sends nothing (no client account). **Reminders before a session are not in the first version**; they are a possible later step and are not decided.
4. **User control (2026-11-16, option B):** each user can **switch each event type on or off, per channel** (email and Telegram) in their settings. There is no single global switch and no mandatory-only mode. Risk noted: a user can switch off an important event (for example a cancellation notice); see the follow-up question below.
5. **Critical events cannot be switched off completely (2026-11-16, option A):** a cancellation made by the other side (events 2, 3 and 4) and the booking confirmation (5) must keep **at least one channel on**; a user may turn off Telegram or email but not both. The "new booking" notice to the masseur (1) may be switched off completely, because the masseur sees bookings in the calendar.
6. **Email verification (2026-11-16, option A):** the user confirms their email address with a link or a code at registration, and notifications are sent **only to a confirmed address**. This applies to the client (new real email at registration) and, since the same address will receive notices, to the masseur as well. Until confirmed, email notifications are not sent.
7. **Language (2026-11-16, option A):** the preferred language (English or Ukrainian) is **stored in the user account**; notifications are sent in it. At registration it is set from the language selected at that moment, and the user can change it in the profile.
8. **Message content (2026-11-16, option A):** an informative message **without phone numbers**: the event type, the date and time (in the masseur's timezone with a label, [BR-006](#br-006)), the name of the other party, the massage type, for a client cancellation the **reason** ([BR-004](#br-004)), and a link to the application. Phone numbers are not put into emails or Telegram messages.
9. **Delivery failures (2026-11-16, option A):** a failed notification is **retried automatically for up to a day**; every send and failure is recorded in a log (without unnecessary personal data, XR-1); and the event stays visible in the application for as long as the booking exists (a cancelled booking is kept 7 days, [BR-011](#br-011)), so a user who missed a message can still see the cancellation there.
10. **A user who has not connected Telegram** simply receives email; Telegram is optional.
11. **Timing:** a cancellation notice is sent **at once** when the cancellation happens, so it is delivered well before the cancelled booking is deleted after 7 days.

**Status: Implemented** ([#17](https://github.com/dmytro-koliasa/massagego/pull/17) email + outbox, [#18](https://github.com/dmytro-koliasa/massagego/pull/18) Telegram, [#19](https://github.com/dmytro-koliasa/massagego/pull/19) event-4 on account deletion).

**PR 12 implementation notes:** Resend provider; Postgres `NotificationPreference` + `NotificationOutbox`; Vercel Cron every 5 minutes with backoff 1→5→15→30 min and 24h max age; separate Notifications pages (email only); critical email locked on until Telegram; short transactional EN/UK copy; walk-ins send nothing; unverified/synthetic emails skipped.

**PR 13 implementation notes (groomed 2026-11-17):** Telegram webhook bot; link token 15 min; prefs unlock critical email when Telegram connected; outbox `channel=telegram`; disconnect app + `/disconnect`; privacy/terms pages.

**Reminders (groomed 2026-11-17):** one client reminder event `booking_reminder` (not critical). Masseur sets `reminderHours` to Off or `2|4|12|24` (default 24). Cron via `/api/cron/notifications` claims due bookings with `reminderSentAt`; skip walk-ins and bookings created inside the reminder window. Changing the masseur setting affects not-yet-sent bookings.

**Open sub-questions remaining:** production Resend domain/sender setup (P-3); Telegram bot creation and webhook registration on the host (P-4); whether an in-app notification list is added later (not decided); legal review of privacy/terms (P-2 / XR-1).

### BR-010

**Business question:** Which masseurs may clients see and book?
**Baseline (pre track-2):** Every masseur account is listed, even with no profile, massage types or availability.
**Why:** Clients can open empty or half-configured profiles.
**Options:** **A.** List all. **B.** List only masseurs with required profile fields and at least one future slot. **C.** Explicit "published" toggle.
**Recommendation: B.**
**Impact:** UI (list), `GET /api/masseurs` query, no DB change for B, C needs a flag.

**Decision (Approved 2026-11-16; Implemented in PR 11):** a fourth variant chosen by the owner.

1. **Who is listed:** a masseur appears in the client list only if (a) the **profile is complete** (name in at least one language, **canonical** `cityPlaceId`, address and phone; legacy `city` alone is not enough) **and** (b) they have **at least one availability record in their history** (past, future or booked; "ever published a slot"). A masseur who never published any slot is not listed. A masseur whose slots are all booked, in the past or inside the lead-time window **stays listed**. Known limitation accepted by the owner: availability records that were deleted are not remembered, so a masseur who removed every slot disappears again.
2. **Card label** (option C): every card in the grid shows a status plaque. **Green:** the nearest free time that a client can book within the 120-day window ([BR-003](#br-003)), e.g. "Nearest: tomorrow, 10:00 (Kyiv, UTC+2)". **Red:** "No free time" / "Немає вільного часу". "Free" means a future slot that is not booked and is outside that masseur's client lead time ([BR-002](#br-002)). The time is shown in the masseur's timezone with a label ([BR-006](#br-006)). The label always contains text, not only colour (accessibility).
3. **Order in the list:** masseurs with free time first, then the others; within each group, newest first. City filter, pagination totals and city options count **only listed** masseurs.
4. **Direct link to a profile that is not listed or not complete:** the page still opens, but booking is not possible and a "profile is not ready yet" / "Цей профіль ще не готовий." message is shown. Existing links do not break.
5. **Masseur email is removed from the list response** (`GET /api/masseurs`): clients do not need it, and the contact for clients is the masseur's phone ([BR-004](#br-004)). **Closes C-9.**

**Implementation:** `src/lib/masseur-catalog.ts`, `src/app/api/masseurs/route.ts`, `src/components/client-masseurs-view.tsx`, client masseur booking page; `tests/masseur-catalog.test.ts`.

### BR-011

**Business question:** What happens to bookings and personal data when accounts are removed, and how long are cancelled bookings kept?
**Baseline (pre track-2):** No deletion UI. Cascading delete of masseur data; client deletion nulls `clientUserId`. Cancelled rows are kept indefinitely.
**Why:** Privacy and legal obligations; history integrity.
**Options:** **A.** Hard delete. **B.** Soft delete with anonymisation of personal data, retaining booking history. **C.** Retention period.
**Recommendation: B.**
**Impact:** UI (delete account), API, DB (soft-delete fields / anonymisation job), existing rows unaffected.

**Status: Implemented** ([#19](https://github.com/dmytro-koliasa/massagego/pull/19)).

*Account deletion (question 1, option B).* A user deletes their own account in the application. Personal data is erased or anonymised (name, phone, email, photo, address, description). Bookings that remain are kept for the other party's history, with the deleted person's name and phone replaced by "deleted user" and no phone number. The phone number becomes free for a new registration.

*Future bookings on deletion (question 2, option C).*
- **Client:** may delete the account at any time. Their future bookings are **cancelled automatically** (the cancellation cutoff of [BR-004](#br-004) does not apply), with the reason "client account deleted" (no free text) and `cancelledBy` = client; the hours become free; the masseur sees it in the calendar and is notified ([BR-009](#br-009) event 4).
- **Masseur:** cannot delete the account while there are **active future bookings**. They must first cancel them under the normal masseur cancellation rules.

*Cancelled bookings (question 3, owner's modified option B).*
1. A cancelled booking **without payment or open obligations** is **physically deleted** from the database (hard delete, no anonymisation and no soft delete) **7 days after the cancellation** (counted from `cancelledAt`, [BR-005](#br-005)). It applies to cancellations by the client, by the masseur and to automatic cancellations on account deletion.
2. After deletion the booking appears **nowhere** (history, calendars, other screens).
3. A cancelled booking with **financial or legal obligations** (refunds, accounting, a dispute, a legal duty to keep it) keeps **only the data needed for that purpose** and is **not deleted automatically**. No payments exist today ([BR-015](#br-015) is deferred), so this branch has no data yet; its criteria must be defined when payments or disputes are introduced.
4. **Completed (held) bookings:** the retention policy is **not decided here** and no new retention period is introduced; see [BR-018](#br-018). Until then they are kept while the accounts exist and are anonymised when an account is deleted (see account deletion above).
5. The previously agreed account-deletion behaviour is kept, as it does not conflict with this decision.
6. A **regular background job** (cron) deletes the bookings that meet the conditions. It must take into account relations between tables, financial records, audit and unresolved disputes.
7. Rationale: the seven days is a product decision (minimise personal data and database growth), not a legal requirement; see XR-1 above.

**Acceptance criteria (for track 2):**
- A booking cancelled more than 7 days ago, with no payment or open obligation, no longer exists in the database and is not returned by any API or shown in any screen.
- A booking cancelled less than 7 days ago still exists and is shown as before (for example the cancellation reason in the masseur's slot details, [BR-004](#br-004)).
- The seven days are counted from the cancellation time (`cancelledAt`), not from the session time.
- A booking with a financial or legal obligation is never removed by the job.
- After the job runs, the hour of a deleted cancelled booking is unaffected (availability is a separate record) and the booking exclusion constraint is not affected.
- Deleting a client account cancels their future bookings, frees the hours and anonymises the remaining data; deleting a masseur account is refused while future bookings exist.
- The job is idempotent and safe to run repeatedly, and failures are logged without losing data.

**Technical consequences (for track 2):** a scheduled job (for example a cron route or a platform cron) running at least daily; `cancelledAt` must exist ([BR-005](#br-005)) and be indexed together with the status; deleted bookings leave no cancellation history, so the reason, `cancelledBy` and the notification ([BR-009](#br-009)) must be used within the 7 days; account deletion needs a transaction that cancels bookings, anonymises the user and frees identifiers; copies of the data in backups and logs must follow the same minimisation (to be reviewed under XR-1); the obligation flag needed for point 3 does not exist yet and must be designed with payments; the one-way nature of hard delete means a wrongly cancelled booking cannot be restored after 7 days.

**Effects on earlier decisions:** the cancellation reason and `cancelledBy` ([BR-004](#br-004), [BR-005](#br-005)) are visible to the masseur only until the booking is deleted; the "last cancellation" shown in slot details is limited to the last 7 days; per-reason statistics over longer periods are not possible without a separate aggregate that holds no personal data.

### BR-018

**Business question:** How long are completed (held) bookings kept, and what happens to their personal data?
**Baseline (pre track-2):** kept indefinitely; no deletion or anonymisation exists.
**Options considered:** **A.** keep while accounts exist, anonymise on account deletion; **B.** anonymise personal data after a fixed period; **C.** hard delete the record after a fixed period.

**Status: Implemented** ([#19](https://github.com/dmytro-koliasa/massagego/pull/19)).

**Decision (option C, with a period of 3 months).** Created from point 4 of [BR-011](#br-011), which left this open.

1. **Hard delete after 3 months:** a completed (held) booking is **physically deleted** from the database **3 months after the session**, by the same regular background job as in [BR-011](#br-011). No anonymised copy or soft delete is kept. After deletion the booking appears nowhere (client session list, masseur calendar details, other screens).
2. **Only when there are no obligations:** a booking with **financial or legal obligations** (payments, refunds, accounting, a dispute, a legal duty to keep it) is **never deleted automatically**. No payments exist today ([BR-015](#br-015) is deferred), so this clause has no data yet. When payments are introduced, payment data must live in **separate records with their own legally required retention**, which are not deleted together with the booking; the obligation flag and its criteria are to be designed with payments and legal advice.
3. **Account deletion** ([BR-011](#br-011)) is unchanged: remaining bookings of a deleted account are anonymised if they still exist.
4. **Consequence accepted by the owner:** a client's and a masseur's history of past sessions is available for **3 months only**. A course of up to 20 sessions ([BR-016](#br-016)) that lasts longer than 3 months loses its earliest sessions from the history before the course ends. Statistics over longer periods are not possible without a separate aggregate that holds no personal data.
5. The period is a **product decision** to minimise personal data and database size, not a legal requirement; the legal review described in XR-1 applies (national exceptions, accounting and consumer-protection duties).
6. **The 3 months are counted from the session start** (`slotStart`), not from its end.
7. **History hint (groomed):** the client's session list and the masseur availability calendar show a short retention hint — EN: "Past sessions older than 3 months are removed." / UK: "Сеанси старші за 3 місяці видаляються." (`sessionsHistoryHint`). The full retention information belongs in the privacy policy (XR-1).

**Acceptance criteria (for track 2):** a completed booking whose session started more than 3 months ago and that has no obligation no longer exists in the database and is not returned by any API or shown in any screen; a booking whose session was less than 3 months ago is unaffected; a booking with an obligation is never removed by the job; the job is idempotent and logs failures without losing data; the cancelled-booking rule (7 days) and this rule are enforced by the same job.

**Open sub-questions for track 2 (remaining):** the obligation flag and the separate payment records, to be designed with [BR-015](#br-015); backups and logs under XR-1.

### BR-012

**Business question:** Do prices or massage-type-specific durations exist?
**Current implementation:** Neither. Massage type is a label only.
**Options:** **A.** Out of scope. **B.** Optional price per type. **C.** Price and duration per type (depends on BR-001).
**Recommendation: A** until payments or fixed pricing are planned.
**Impact:** A - none. B/C - UI, API, DB (new fields), and booking snapshot of price.

**Status: Deferred (2026-11-16).** Prices and payments are postponed together with [BR-015](#br-015) (late-cancellation fee and online payment) and [BR-016](#br-016) (courses). Not groomed and not to be implemented yet.

### BR-013

**Business question:** Which countries' phone numbers are accepted?
**Current implementation:** shared blocklist `EXCLUDED_COUNTRY_CODES` (UN M49 Africa + `RU` + `BY`); phone picker uses `PHONE_COUNTRIES_ALLOWED`; city geocode filters by the same list.
**Options:** **A.** Keep and document. **B.** Allow all valid numbers.
**Recommendation: A** if the launch market is EU + UA; revisit with expansion.
**Impact:** none for A; B changes the phone picker and validation only.

**Decision (Approved 2026-11-16):** **Option B with exclusions.**

1. **Accepted phone numbers:** any valid international phone number, **except** numbers from (a) **all African countries**, (b) **Russia**, (c) **Belarus**. All other countries are allowed. The stored format stays E.164.
2. **Where it applies:** everywhere a phone is entered: client registration and login, the masseur's profile phone ([BR-004](#br-004)) and the masseur's walk-in bookings.
3. **Phone picker:** Ukraine stays the default country; the other allowed countries are available (searchable), and the excluded countries are not offered.
4. **The same exclusions apply to city search (decided 2026-11-16):** cities in the excluded countries are **not offered** in the city search, for masseurs (profile city) and for clients (city at registration, [BR-017](#br-017)), and are not shown as filter values in the masseur list. This replaces the earlier idea that the city search stays unchanged.
5. **One shared blocklist:** the excluded countries are defined **once**, as a single list of country codes in the code base, used by **both** the phone validation and the city search, so that the two can never disagree. Changing the list is a code change (there is no administration screen for it).
6. **Scope of the rule:** it restricts phone numbers and the cities that can be chosen; it does not detect where a person actually is.

**Implementation ([#11](https://github.com/dmytro-koliasa/massagego/pull/11), groomed 2026-11-17):**
- **List:** UN M49 Africa (region 002), including dependent territories (e.g. `RE`, `YT`, `EH`, `IO`, `SH`, `TF`) and Egypt; plus `RU` and `BY`. Kazakhstan (`KZ`) is not excluded.
- **+7:** country resolved with `libphonenumber-js` (`RU` rejected, `KZ` accepted).
- **Phone error:** `phone_country_excluded` → EN `This country code is not supported.` / UK `Цей код країни не підтримується.` (same copy for auth and walk-in). Malformed numbers keep `invalid_phone`.
- **City search empty:** generic `No cities found.` / `Міст не знайдено.` (no mention of the blocklist).
- **Existing data:** no migration or forced phone change; enforcement on new input only (test DB; none expected from the prior EU+UA allowlist).
- **Catalog city filter:** masseur `city` is still a free-text label without a country code, so the list API cannot country-filter stored values yet; exclusion is enforced at Nominatim city search. Canonical city + country (PR 8 / [BR-017](#br-017)) can tighten the catalog filter later.

### BR-014

**Business question:** How are sessions longer than 60 minutes (e.g. Thai massage) booked, given that [BR-001](#br-001) fixes the slot at 60 minutes?
**Baseline (pre track-2):** A client may select several hours in one request; each hour becomes an independent booking with no link between them. Nothing knows that Thai massage needs more than one slot, and cancelling one hour leaves the others booked.
**Options considered:** (1) enforce a minimum number of consecutive slots per massage type; (2) UI hint only; (3) group bookings so that they are cancelled together.

**Decision (Approved 2026-11-16):** UI hints only, **no enforcement and no grouping**. The client is reminded through toasts; the data model is unchanged and each hour stays an independent booking.

1. **Booking hint.** When the client selects the massage type **Thai** (changing the type to Thai), a toast recommends choosing more than one consecutive slot.
2. **Slot-selection hint.** While the type is Thai, the same toast is shown again after the client selects a slot in the calendar.
3. **Cancellation hint.** When a client cancels one of several consecutive slots and the massage type is Thai, a toast recommends cancelling the neighbouring slot as well, because the massage type is Thai. **If the neighbouring slot can no longer be cancelled** (it is already inside the masseur's cancellation cutoff, [BR-004](#br-004)), the toast says so and shows the masseur's phone number, so the client can contact the masseur (decided 2026-11-16, finding X-1, option A). Bookings stay independent: no grouping and no forced joint cancellation, so in that rare one-hour window a client may end up with only part of a long session.
4. **Toast behavior.** These toasts are closed **only by the user** (no auto-dismiss).
5. Booking more or fewer slots remains allowed; the toasts are recommendations, not validation.

**Implementation (PR 6):** slot-selection toast suppressed when ≥2 consecutive hours are already selected; type-change toast always; consecutive = same masseur, same client, Thai type, adjacent hour; no one-click neighbour cancel; client booking UI only; wording as groomed (EN/UK).

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

### BR-016

**Status: Deferred (2026-11-16). A future to-do, not an approved rule.** Nothing here may be implemented or shown to users yet.

**Idea (from the owner):** massage is often sold as a **course** of 10-15 sessions, at most 20. The application could support courses as a concept.

**Why deferred:** there is no "course" (package) concept: no price per course, no validity period, no tracking of used and remaining sessions. It depends on prices and payments ([BR-012](#br-012), [BR-015](#br-015)). For now a client simply books many individual sessions; the cap of 30 active future bookings in [BR-008](#br-008) was chosen so that courses are not blocked.

**Questions for when it is picked up:** who sells and prices a course (per masseur); how sessions are linked to a course and counted; validity period; cancellation and refund of unused sessions; whether a course is bound to one masseur; how it interacts with the cancellation cutoff ([BR-004](#br-004)) and the Thai-massage hints ([BR-014](#br-014)).

### BR-017

**Business question:** How is the list of masseurs narrowed for a client, so that a client in Kyiv does not have to browse masseurs from the whole country?
**Baseline (pre track-2):** The client has **no city**: registration asks only for name, phone and password, and the client profile edits only names. The masseur list defaults to "all cities" and the client must pick a city in a filter. Cities in the filter are the cities of masseurs, stored as plain text chosen from OpenStreetMap suggestions in the masseur's interface language, so the same city may be stored as "Київ" and "Kyiv" and appear twice.
**Why:** The default list is long and not relevant to the client.
**Options:** **A.** City required at client registration; the list defaults to the client's city. **B.** Ask for the city on first visit to the list. **C.** Detect the city automatically (IP or browser geolocation). **D.** Remember the last chosen city in the browser.
**Recommendation: A.**
**Impact:** UI (registration form, profile, list filter default), API (client register and profile, `GET /api/masseurs`), **DB** (a city for the client), existing clients without a city.

**Decision (Approved 2026-11-16):** **Option A.**

1. **Client city:** the client chooses a **city at registration (required)**, with the same city search used by masseurs. It can be changed in the client profile.
2. **List default:** the masseur list opens filtered to the **client's city**. The client can switch to another city or to all cities. This works together with the visibility rules of [BR-010](#br-010).

**Implementation (PR 8, groomed 2026-11-17):**
- **Canonical city:** `cityPlaceId` (Nominatim) + `cityCountryCode` + `cityNameEn` / `cityNameUk` (+ optional lat/lon); legacy `city` string kept for old rows without backfill.
- **Empty city list:** message + “Show all cities” / “Показати всі міста”.
- **Incomplete clients:** complete-profile banner; sign-in and browse allowed; booking blocked until city + real email exist.
- Automatic geolocation (option C) stays out of scope.

**Related:** [BR-010](#br-010) (who is listed and in what order).

### BR-019

**Business question:** How does a user recover access to an account (forgotten password) and how does a client sign in once an email exists ([BR-009](#br-009))?
**Current implementation:** Password reset via one-time email link (PR 9): client requests by phone, masseur by email; link uses `VerificationToken` with identifier `password-reset:${userId}`; TTL 1 hour; new request invalidates the previous token; email sent only when the user has `passwordHash` and `emailVerified`; request always returns the same success message; after confirm, all `Session` rows for the user are deleted.
**Why:** A user who forgets a password is locked out. With a verified email ([BR-009](#br-009)) a reset becomes possible.
**Status: Implemented** ([#13](https://github.com/dmytro-koliasa/massagego/pull/13)). Added 2026-11-16 from the gaps noted in the review (`user-roles.md`).

**Decision (2026-11-16, option A):** **password reset by email link**, for both roles. The user enters their phone (client) or email (masseur) and receives a one-time link, valid for a limited time, to set a new password; it is sent to the **verified** email ([BR-009](#br-009)). SMS codes and manual reset by support were considered and not chosen (SMS may come later with [BR-023](#br-023)).

**Client sign-in (2026-11-16, option A):** the client keeps signing in with the **phone number and password only**. The verified email is used for notifications and for password reset, not for sign-in. The masseur signs in as today (email and password, or Google).

**Implementation notes (groomed 2026-11-17):** link lifetime **1 hour**, one-time; same success response whether or not an email was sent (enumeration-safe); Google-only / unverified / missing password → no email; open sessions cleared after a successful reset.

### BR-020

**Business question:** How is the service protected from abuse (brute-force login, mass registration, booking spam)?
**Current implementation:** Sliding-window rate limits in PostgreSQL (`RateLimitBucket`, PR 9): sign-in 10 / 15 min per IP and per account; registration 5 / hour per IP; password-reset request 5 / hour per IP and per identifier; booking create/cancel 30 / 15 min per IP and per account. Over limit → HTTP 429 with EN/UK “Too many attempts…” copy. Sign-in IP limit is applied inside Auth.js `authorize` via the request object (best-effort if proxy headers are absent).
**Why:** Open endpoints can be attacked; the booking limits in [BR-008](#br-008) do not stop automated abuse.
**Status: Implemented** ([#13](https://github.com/dmytro-koliasa/massagego/pull/13)). Added 2026-11-16.

**Decision (option A):** basic **rate limits per IP and per account** on the sensitive requests: sign-in, registration, password reset ([BR-019](#br-019)), booking creation and cancellation. After the limit is exceeded the request is blocked for a while with a clear message. Considered and not chosen: limits only on sign-in and reset (B), a captcha on top of limits (C; may be added later if real bots appear, it would send data to a provider, XR-1), and doing nothing (D).

**Implementation notes (groomed 2026-11-17):** counters stored in Postgres (addresses the rate-limit half of P-5); exact limits as above; shared IPs share the per-IP budget (accepted for v1).

### BR-021

**Business question:** Is there an administrator or support role, and what can it do (view, block or delete accounts, handle complaints, edit the country blocklist)?
**Current implementation:** Minimal admin portal with user list, block/unblock, audit log, and complaints inbox (`/admin/complaints`).
**Why:** Account deletion ([BR-011](#br-011)), complaints and abuse ([BR-020](#br-020)) need someone to act.
**Status: Implemented** ([#20](https://github.com/dmytro-koliasa/massagego/pull/20)); complaints [#26](https://github.com/dmytro-koliasa/massagego/pull/26). Added 2026-11-16.

**Decision (option B):** a **minimal administration panel** with a list of users, **blocking and unblocking** accounts, and a view of complaints. Considered and not chosen: no admin role with everything done by hand (A), and an external database tool without our own panel (C).

**PR 15 implementation notes (groomed 2026-11-17):** separate portal `admin` with header link (not on the home hero); one super-admin from `ADMIN_BOOTSTRAP_EMAIL` + `ADMIN_BOOTSTRAP_PASSWORD` (no email verify / 2FA in this PR); complaints **out of this PR**; block signs the user out and refuses new login/bookings while existing future bookings stay; admin sees a full read-only profile; `AdminAuditLog` with UI at `/admin/audit`; excluded countries stay in code; blocked users see an explicit blocked message asking them to contact support; block only `client` / `masseur` (never admin); list filters Active / Blocked / Deleted.

**Complaints (groomed 2026-11-17):** client↔masseur only when linked by a booking (`bookingId` required; walk-ins excluded); category `no_show|rude|spam|other` + body ≤500; rate limit 5/hour/account (+ IP); target never sees the complaint; admin inbox `/admin/complaints` with Open/Resolved/Dismissed + internal note; audit on status change; no email notify in v1.

### BR-022

**Business question:** What rules apply to uploaded images (profile photo, gallery)?
**Baseline (pre track-2):** Gallery: JPEG or PNG, up to 5 MB, 3 images per masseur; the type comes from the file's declared type and the size from the request, without checking the actual file content; avatars follow similar rules.
**Why:** Unverified uploads can carry unsafe content; image rules also affect storage cost and privacy ([XR-1](#cross-cutting-requirements)).
**Status: Implemented** ([#14](https://github.com/dmytro-koliasa/massagego/pull/14)). Added 2026-11-16.

**Decision (option A):** the server **checks the real content of an uploaded image** (not the declared type), **computes the width and height itself**, and **re-saves the image** in a safe format, which also **removes embedded metadata such as GPS location**. The size and dimension limits stay enforced. Considered and not chosen: checking without re-saving (B) and keeping the current behaviour (C).

**Implementation notes (groomed 2026-11-17):** library **sharp**; input **JPEG / PNG / WebP** only (reject GIF and others by detected format); output **JPEG ~85**, except **PNG with alpha stays PNG**; strip all metadata after `rotate()` (EXIF orientation); max long side **2000px**, never upscale; keep **5 MB** input and **3** gallery images; same pipeline for gallery and masseur/client avatars; API error codes `invalid_type`, `too_large`, `process_failed`.

### BR-023

**Business question:** Is the phone number verified (for example by an SMS code) at registration?
**Current implementation:** Optional Telegram contact-share confirmation sets `phoneConfirmedAt`; not required to register or book.
**Why:** The phone is both the login and the number a masseur sees; an unverified phone allows impersonation. SMS costs money ([BR-009](#br-009) discussed SMS).
**Status: Implemented** ([#18](https://github.com/dmytro-koliasa/massagego/pull/18)). Added 2026-11-16.

**Decision (option B):** an **optional confirmation of the phone number through the Telegram bot** of [BR-009](#br-009). The user who connects Telegram can share their contact with the bot (the standard "share my number" button); the bot checks that the contact belongs to the same Telegram account and that the number **matches the phone in the application account**. If so, the account gets a **"phone confirmed" mark**, which the masseur sees next to the client's name in a booking. The confirmation is **not required** to register or to book. Considered and not chosen: no confirmation (A), mandatory Telegram confirmation for everyone (C; it would exclude people without Telegram and contradict BR-009) and SMS codes (D; paid, needs a provider).

**PR 13 implementation notes (groomed 2026-11-17):** mark in masseur slot details as ✓ + Confirmed/Підтверджено; mismatch refuses with a hint to update the phone in the app; masseurs may confirm the same way (mark UI for masseurs deferred); `/privacy` and `/terms` cover Telegram as a processor pending P-2 legal review; one chat may notify both portal Users when email or phone matches; phone confirmed applies only to the portal that requested share-contact.


---

## Code inconsistencies

### Genuine inconsistencies (code vs code)

Until each item is groomed and approved, its status stays **Open**. These are defects in the as-is behavior; fixing them still goes through grooming (see workflow above).

| ID | Finding | Evidence | Status | Closed by (when implemented) |
|---|---|---|---|---|
| C-1 | **Started-slot rule differs by path.** Client API accepts a slot that started up to 60 min ago; masseur API and resolve route reject any started slot; the client UI hides started slots. | `bookings/route.ts` (`slotStart.getTime() < now - SLOT_MS`) vs `masseur/bookings/route.ts` (`isSlotExpired`) vs `masseurs/[id]/availability/route.ts` (`rangeStart`) | **Implemented** ([#8](https://github.com/dmytro-koliasa/massagego/pull/8)): lead time; no 60-minute grace | [BR-002](#br-002) |
| C-2 | **Business hours use server-local time on the server and browser-local time in the UI.** If the server timezone differs from users' (likely for UTC hosting; actual deployment timezone **not verified**), the server rejects hours the UI offers (e.g. 05:00-06:59 local) and permits hours the UI hides. | `isWithinBusinessHours` (`getHours`) vs `masseur-availability-calendar.tsx` (`getWeekSlotStarts`) | **Implemented** ([#5](https://github.com/dmytro-koliasa/massagego/pull/5), [#6](https://github.com/dmytro-koliasa/massagego/pull/6)) | [BR-006](#br-006) |
| C-3 | **Business hours not enforced everywhere.** Masseur walk-in route and weekly-copy `template` accept any hour, and the walk-in route creates an availability row outside 05:00-23:00. | `masseur/bookings/route.ts`, `masseur/availability/route.ts` (`PUT`) | **Implemented** ([#7](https://github.com/dmytro-koliasa/massagego/pull/7)) | [BR-007](#br-007) |
| C-4 | **Past-time checks are UI-only for availability edits.** `POST /api/masseur/availability` does not reject started or past hours; the resolve and masseur-booking routes do. | `applySlotChange` | **Implemented** ([#7](https://github.com/dmytro-koliasa/massagego/pull/7)) | [BR-007](#br-007) |
| C-5 | **Past cancellation asymmetry.** A client can cancel past/ongoing bookings; a masseur cannot. | `bookings/cancel/route.ts` vs `resolve/route.ts` | **Implemented** ([#9](https://github.com/dmytro-koliasa/massagego/pull/9)): client cancel cutoff refuses past/ongoing; masseur resolve still refuses started slots | [BR-004](#br-004) |
| C-6 | **Weekly copy shifts by `setDate(+7)` in server-local time.** Under a DST change the copied slots can move by one hour relative to users' local clock when the server timezone is UTC. | `addWeeks` in `masseur/availability/route.ts` | **Implemented** ([#5](https://github.com/dmytro-koliasa/massagego/pull/5)): `addLocalWeeks` in the masseur's zone | [BR-006](#br-006) |
| C-7 | **Re-cancelling returns 403 `forbidden`**, not an idempotent success or 404, because a missing, foreign or already-cancelled booking are indistinguishable by design. | `bookings/cancel/route.ts` | **Implemented** ([#9](https://github.com/dmytro-koliasa/massagego/pull/9)) | this item, see "Decisions on C-7 and C-8" below |
| C-9 | **Masseur email is returned to every client.** `GET /api/masseurs` selects `email` and includes it in the JSON, but the UI never displays it. Whether masseur contact details should be public is an undecided product/privacy question; no `BR` item exists yet (only the code behavior is recorded here). | `src/app/api/masseurs/route.ts` | **Implemented** (PR 11): email removed from the list response | [BR-010](#br-010) |
| C-8 | **Schema comment drift.** `Booking.clientUserId` is commented "Required for new bookings" but masseur walk-ins create it as `null`. Fields `preferredDate`, `preferredTime`, `clientEmail` are written as `null` and otherwise unused. | `prisma/schema.prisma`, both create routes | **Implemented** ([#4](https://github.com/dmytro-koliasa/massagego/pull/4)) | this item, see "Decisions on C-7 and C-8" below |

**Decisions on C-7 and C-8 (grooming, 2026-11-16):**

- **C-7 (Implemented in [#9](https://github.com/dmytro-koliasa/massagego/pull/9)), option A:** when a client cancels a booking that is **their own and already cancelled**, the request **succeeds** ("already cancelled"). When the booking **does not exist or belongs to someone else**, the server returns the **same 404 `not_found`** for both cases, so that other people's bookings cannot be probed. The `403 forbidden` for these cases goes away. This matters because cancelled bookings are deleted after 7 days ([BR-011](#br-011)), so "no such booking" becomes an ordinary situation (for example an old browser tab).
- **C-8 (Implemented in [#4](https://github.com/dmytro-koliasa/massagego/pull/4)), option A:** **remove the three unused columns** `preferredDate`, `preferredTime` and `clientEmail` from `Booking` (a database migration) and **correct the schema comment** on `clientUserId` (it is empty for masseur walk-in bookings). Reasons: the columns are always `null`, the email for notifications comes from the account ([BR-009](#br-009)) and a walk-in client has no account, and the owner wants as little personal data as possible (XR-1). If notifications for walk-in clients are ever wanted, that is added deliberately as a new feature.

### Checked and consistent

- The DB constraint predicate (`status <> 'cancelled'`, `slotStart IS NOT NULL`) matches every application query that treats a slot as occupied (`status: { not: "cancelled" }`).
- Both creation routes use the lock and map conflicts to `slot_taken` (409).
- The client availability view and the client create route agree on "booked" (non-cancelled booking at the same `slotStart`).
- Zod validation and server checks agree for names, phone, note and massage type; the UI additionally uses native validation helpers.

### Suggested enhancements (not inconsistencies)

Rate limiting on auth and booking endpoints; a stored duration/end on `Booking`; an enum for `status`; booking audit fields (`cancelledAt`, `cancelledBy`); replacing the duplicated `SLOT_MS`/`alignToHour` helpers with one shared module. These are **Proposed** only. (Several of them were later decided: rate limiting is [BR-020](#br-020), the `status` enum and audit fields are in [BR-005](#br-005).)

---

## Cross-decision review

A review of all **Approved** decisions against each other, made on 2026-11-16. The consolidated data changes are in [data-model-changes.md](data-model-changes.md).

### Checked and consistent

- Lead time and cancellation cutoff: the cutoff cannot be below the lead time ([BR-002](#br-002), [BR-004](#br-004)), so a freed slot can be booked again.
- Account deletion and cancellation: a client deleting an account cancels future bookings regardless of the cutoff, while a masseur cannot delete with future bookings ([BR-011](#br-011), [BR-004](#br-004)).
- Cancellation data and deletion: the reason, `cancelledBy` and the notice live only until the 7-day deletion; the notice is sent at once ([BR-004](#br-004), [BR-005](#br-005), [BR-009](#br-009), [BR-011](#br-011)).
- Name and phone from the account, anonymised on account deletion ([BR-008](#br-008), [BR-011](#br-011)); the email of a deleted client is erased ([BR-009](#br-009)).
- Timezone: the working window, the booking window, the card label and notification times all use the masseur's timezone ([BR-006](#br-006), [BR-007](#br-007), [BR-003](#br-003), [BR-010](#br-010), [BR-009](#br-009)).
- Phones: the masseur's public phone is shown in the application but is not put into notifications ([BR-004](#br-004), [BR-009](#br-009)); the same blocklist drives phone and city ([BR-013](#br-013), [BR-017](#br-017)).
- The 30-booking cap counts only active future bookings, so the 3-month and 7-day deletions do not affect it ([BR-008](#br-008), [BR-018](#br-018)).
- Courses: the cap of 30 and the 120-day window fit a course of up to 20 sessions, but the 3-month history can drop its earliest sessions; this was accepted ([BR-016](#br-016), [BR-018](#br-018)).

### Findings that need attention

| ID | Finding | Where it comes from | Suggested handling | Status |
|---|---|---|---|---|
| X-1 | **Consecutive Thai slots at the cutoff boundary.** The toast recommends cancelling the neighbouring slot, but the neighbour may already be inside the cancellation cutoff, so the client can cancel one hour and not the other. | [BR-014](#br-014), [BR-004](#br-004) | Decide what the client sees when only one of the consecutive slots can still be cancelled (a message; or treat consecutive slots of one booking as cancellable by the earlier slot's cutoff) | **Approved** (2026-11-16): option A, see below |
| X-2 | **Timezone could be derived from the city.** The masseur's city is chosen from the map service, which knows the location; the timezone could be proposed automatically instead of asked. | [BR-006](#br-006), [BR-017](#br-017) | Propose via `geo-tz` from city coordinates; masseur confirms/edits | Decided in PR 8 |
| X-3 | **Registration becomes long for clients:** name, phone, email (verified), city and password. | [BR-008](#br-008), [BR-009](#br-009), [BR-017](#br-017) | Single-screen form (groomed PR 8) | Decided in PR 8 |
| X-4 | **Masseur cancels many bookings by hand** before deleting an account; there is no bulk action and each cancellation notifies a client. | [BR-011](#br-011), [BR-009](#br-009) | Accept for now; consider a bulk cancellation later | Note |
| X-5 | **Registration and login of the client:** the client signs in with the phone; with a verified email ([BR-009](#br-009)) password reset becomes possible, but the decision is not taken. | [BR-009](#br-009) | Decided in [BR-019](#br-019) | Decided in BR-019 |

No contradiction between two approved decisions was found: the items above are gaps or notes, not conflicts. X-1 was decided on 2026-11-16 (option A, in [BR-014](#br-014)); X-2 to X-4 are notes for implementation; X-5 is decided in [BR-019](#br-019) when groomed.

