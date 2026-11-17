# User Roles and Permissions

> **As-is only:** this document is not an approved requirement; decisions are tracked in [decisions.md](decisions.md).
> **Status:** descriptive snapshot refreshed 2026-11-17 after track-2 closeout. It records the access rules the code **enforces today**, not approved requirements.
> Classification tags: **Implemented**, **Needs Decision**, **Proposed** (see [business-rules.md](business-rules.md#how-to-read-this-document)). Decision ids (`BR-xxx`) refer to [decisions.md](decisions.md).

## 1. Roles

There are three portal identities, stored in `User.portal` (`"masseur"`, `"client"` or `"admin"`).

| Role | Sign-in | Notes |
|---|---|---|
| **Client** | Phone number + password | Real email verified for notifications/reset. Portal `client` |
| **Masseur** | Email + password, or Google | Portal `masseur`. Google is offered only on the masseur portal and only when configured |
| **Admin** | Email + password | Portal `admin`. Bootstrap from `ADMIN_BOOTSTRAP_*`; no public registration. See [BR-021](decisions.md#br-021) / AR-17 |
| **Anonymous** | none | Can reach the landing and login pages only |

Complaints / report UI is not built yet (deferred from BR-021). See [BR-010](decisions.md#br-010) for discoverability.

### 1.1 Identity isolation - Implemented

- The same email or phone can exist once **per portal** (`@@unique([email, portal])`, `@@unique([phone, portal])`). One person may therefore hold a client account and a masseur account; they are unrelated rows.
- Each portal has its **own Auth.js instance, base path and cookie names** (`src/auth/portal-config.ts`, `src/auth/create-portal-auth.ts`). A masseur session cookie does not authenticate client endpoints, and vice versa.
- The session callback rejects a token whose `portal` does not match the instance (`token.portal !== portal`), and the `jwt` callback looks the user up **within the portal** (`prisma.user.findFirst({ where: { id, portal } })`).
- Every API handler additionally re-checks the role with the database: `requireClientSession` (`src/lib/client-session.server.ts`) or `userHasPortal(userId, "masseur")`.
- `src/proxy.ts` protects `/masseur/dashboard/**`, `/client/**` and `/admin/**` page routes by reading the matching portal cookie and `token.portal`. API routes do **not** rely on the proxy alone; each performs its own check.
- Google sign-in for a new identity is only accepted when the "register" intent cookie is set; otherwise the user is returned to the portal with `no_portal_access`.

---

## 2. Permissions matrix

Legend: **Y** = allowed, **own** = only for the caller's own records, **-** = not allowed, **n/a** = not applicable.
"Source" is the file that enforces the rule.

### 2.1 Bookings

| Action | Anonymous | Client | Masseur | Source |
|---|---|---|---|---|
| Create booking for a masseur's free slot | - | **Y** (any masseur) | **own** (walk-in for self only) | `api/bookings`, `api/masseur/bookings` |
| Create booking for a slot the masseur has **not** published | - | - | **Y** (walk-in; slot is created) | `api/masseur/bookings` |
| Book several hours in one request | - | **Y** (atomic, no maximum) | - (one per request) | `api/bookings` |
| List bookings | - | **own** (non-cancelled; any time range) | **own** (as masseur, by week) | `api/bookings` GET, `api/masseur/availability` GET |
| See another client's booking details | - | - (shown only as "booked") | **Y** for bookings on own calendar (name, phone, type) | `api/masseurs/[id]/availability`, `api/masseur/availability` |
| Cancel a booking | - | **own** (any time, incl. past) | **own calendar** (before start only) | `api/bookings/cancel`, `api/masseur/bookings/resolve` |
| Edit a booking (time, note, type) | - | - | - | no endpoint exists |
| Confirm / complete / mark no-show | - | - | - | no such status or endpoint ([BR-005](decisions.md#br-005)) |

### 2.2 Availability and calendar

| Action | Anonymous | Client | Masseur | Source |
|---|---|---|---|---|
| View a masseur's availability | - | **Y** (any masseur; future hours only) | **own** | `api/masseurs/[id]/availability`, `api/masseur/availability` |
| Add/remove availability hours | - | - | **own** (05:00-23:00, not on booked hours) | `api/masseur/availability` POST |
| Copy a week forward (1-52 weeks) | - | - | **own** (current week only) | `api/masseur/availability` PUT |
| Make a booked hour unavailable | - | - | **own** (cancels the booking first; before start only) | `api/masseur/bookings/resolve` |

### 2.3 Profiles and data

| Action | Anonymous | Client | Masseur | Source |
|---|---|---|---|---|
| Browse the masseur list and a masseur profile (name, photo, description, massage types, city, address, gallery) | - | **Y** (all masseurs) | **own** profile only | `api/masseurs`, `client/masseur/[slug]/page.tsx` |
| Edit masseur profile, massage types, gallery (max 3 images) | - | - | **own** | `api/masseur/profile`, `api/masseur/gallery*` |
| Edit client profile (en/uk names) and avatar | - | **own** | - | `api/client/profile` |
| Edit masseur avatar | - | - | **own** | `api/masseur/profile` |
| Search cities (OpenStreetMap proxy) | - | - | **Y** | `api/geocode/city` |
| List other clients or other masseurs' private data | - | - | - | no endpoint exists |
| Delete an account | - | - | - | not implemented ([BR-011](decisions.md#br-011)) |

### 2.4 Authentication

| Action | Anonymous | Client | Masseur |
|---|---|---|---|
| Register (`POST /api/auth/register`) | **Y** (either portal) | n/a | n/a |
| Log in | **Y** | n/a | n/a |
| Google sign-in | - | - (not offered) | **Y** (when configured) |

---

## 3. Booking ownership - Implemented

- A booking belongs to exactly one **masseur** (`Booking.masseurId`, required, cascade on delete).
- A booking may belong to one **client account** (`Booking.clientUserId`, nullable, `SetNull` on delete).
  - Client-created bookings: `clientUserId` = the logged-in client.
  - Masseur-created walk-ins: `clientUserId = null`. The client contact is only the free-text `clientName` / `clientPhone`.
- `clientName` and `clientPhone` are **entered per booking**, not read from the client profile. A client may therefore book on behalf of someone else.
- A client can cancel only bookings where `clientUserId` equals their id. Own already-cancelled booking succeeds; missing or someone else's booking returns the same `404 not_found` so ownership cannot be probed (C-7).
- A masseur can cancel only bookings of their own calendar (`masseurId` = session user).
- Walk-in bookings cannot be seen or cancelled by any client, because they have no `clientUserId`.

---

## 4. Data visibility - Implemented

| Data | Masseur sees | Client sees |
|---|---|---|
| Own bookings | Full: client name, client phone, massage type, id | Own bookings: masseur public name, time, massage type, status |
| Other people's bookings on a masseur's calendar | n/a | Only "booked" (no name, phone or type) |
| Client phone number | Yes, for bookings on their calendar | Only their own |
| Masseur address and city | Own | Yes, for every masseur |
| Masseur email | Own | No (removed from `GET /api/masseurs`; C-9 closed in PR 11) |
| Client account list | No | No |

Client phone numbers are visible to a masseur only through bookings on their own calendar.

---

## 5. Authorization restrictions - Implemented

- Unauthenticated API calls return `401 unauthorized`; a valid session of the wrong portal returns `403 forbidden`.
- Client endpoints reject masseur sessions and masseur endpoints reject client sessions, both through separate cookies and a database role check.
- The city-search proxy and gallery endpoints are masseur-only.
- Password policy: 8-64 characters containing a letter, a digit and a symbol.
- Phone numbers must be valid international numbers except African countries, Russia and Belarus ([BR-013](decisions.md#br-013)).
- Uploads: JPEG/PNG only for the gallery, 5 MB maximum, 3 images per masseur.

## 6. Gaps and open points

| Topic | Status |
|---|---|
| No rate limiting on registration, login or booking creation | **Proposed** (not approved) |
| No email/phone verification, no password reset | **Needs Decision** (not covered by a `BR-xxx` item yet) |
| No admin or support role | **Needs Decision** (not covered by a `BR-xxx` item yet) |
| Masseur email returned to every client by `GET /api/masseurs` although not displayed | **Needs Decision** - see C-9 in [decisions.md](decisions.md#code-inconsistencies) |
| Which masseurs are visible to clients | **Implemented** - [BR-010](decisions.md#br-010) (complete profile + availability history; see AR-9) |
| Who may cancel, and when | **Needs Decision** - [BR-004](decisions.md#br-004) |
| Notifying the counterpart of changes | **Implemented** (email, PR 12) - [BR-009](decisions.md#br-009); Telegram in PR 13 |
| Account deletion and retention | **Needs Decision** - [BR-011](decisions.md#br-011) |
