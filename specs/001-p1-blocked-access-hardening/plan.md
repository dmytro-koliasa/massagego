# Plan: P1 blocked-access hardening 

Spec: [spec.md](spec.md) · Issues #177–#181 · Constitution: [../constitution.md](../constitution.md)

## Technical Context

- Next.js 16 App Router, Auth.js JWT (`next-auth` v5 beta), Prisma 6 / Postgres
- Existing JWT revoke: `User.passwordChangedAt` + `applyPasswordVersionToJwt` (`src/lib/auth/password-credential-version.ts`, #79)
- Shared gate: `requirePortalUser` in `src/lib/notifications/portal-gate.ts` (checks portal + `deletedAt` only today)
- Admin block: `src/app/api/admin/users/[id]/block/route.ts` (sets `blockedAt`, deletes Session rows)
- Rate limits: `src/lib/rate-limit.ts` + `rateLimitJsonResponse` / hashed keys (#81)
- Password reset: `src/lib/email/password-reset.ts` (`createAndSendResetLink`, `consumeResetToken`)
- Tests: Vitest unit + integration against `massage_test`; no new E2E required (constitution / spec)
- Stack lock: no Prisma schema migration required for this feature (reuse `passwordChangedAt`)

## Architecture / Approach

Single vertical hardening pass — no new services, no new tables.

```
Admin block ──► bump passwordChangedAt (+ blockedAt) ──► JWT stale (#79)
                      │
                      ▼
requirePortalUser ──► also require blockedAt: null (defense-in-depth)
                      │
createAndSendResetLink ──► if blockedAt → early ok, no token/mail
consumeResetToken ──► if blockedAt → invalid_token
                      │
Write routes ──► FR-3 RATE_LIMITS (IP + account) before business logic
```

**Module move of `portal-gate`:** out of scope (#187). Edit in place.

**Proxy:** unchanged (FR-2).

## Data Model

No schema change. Fields used:

| Field | Use |
|---|---|
| `User.blockedAt` | Gate + reset denial |
| `User.passwordChangedAt` | JWT revoke on block (same as password reset/change) |
| `User.deletedAt` | Already partially checked in portal-gate; keep |
| `RateLimitBucket` | Existing; new key scopes only |
| `VerificationToken` | Must not be created for blocked reset request |
| `Session` | Keep `deleteMany` on block as harmless defense-in-depth; document as non-JWT |

## Contracts / Interfaces

### Admin block (`POST /api/admin/users/[id]/block`)

Update payload in transaction:

```ts
data: { blockedAt, passwordChangedAt: blockedAt } // same Date instance OK
```

Comment near `session.deleteMany`: JWT revoke is `passwordChangedAt`, not Session rows.

Extend `tests/integration/admin-audit.test.ts` (or sibling) to assert `passwordChangedAt` set and stale vs pre-block stamp (pattern from `admin-password-change-jwt.test.ts`).

### `requirePortalUser` / `resolvePortalUser`

```ts
select: { portal: true, deletedAt: true, blockedAt: true }
// ok only if portal match && !deletedAt && !blockedAt
```

If Auth.js already cleared the session (jwt + blockedAt / stale pwd), callers see **401**. If a session user id is still present but DB row is blocked → treat as not resolved → with hint/session path should surface **403** when we can distinguish “session existed but not allowed”. Practical approach aligned with current helpers:

- Prefer matching `requireClientSession`: session missing → 401; session present but DB rejects → 403.
- Today `requirePortalUser` collapses “not resolved” to `unauthorized()` (401) when hint points at a missing portal user. **Adjust:** when the matching portal session has a `user.id` but `resolvePortalUser` returns null → **403 `forbidden`** (not 401). When no session id at all → **401**. Preserves FR-4 and dual-session hint behavior; `ambiguous_portal` unchanged (FR-6).

### Password reset

`createAndSendResetLink`: after user lookup, if `user.blockedAt` → `return { ok: true }` before token/mail (same as missing password).

`consumeResetToken`: include `blockedAt` in user select; if set → delete token(s) optional cleanup → `invalid_token`.

### Rate limits

Add to `RATE_LIMITS` in `src/lib/rate-limit.ts` (names illustrative):

| Key | limit / window | Applied on |
|---|---|---|
| `galleryUpload` | IP 20, account 10 / 15m | `POST` gallery |
| `availabilityWrite` | IP 60, account 60 / 15m | `POST`+`PUT` availability |
| `masseurBookingCreate` | IP 30, account 30 / 15m | `POST` masseur bookings |
| `profileWrite` | IP 30, account 20 / 15m | client + masseur profile writes |
| `verifyEmailResend` | IP 5, account 5 / 1h | verify-email resend |

Wire with `getClientIp`, `rateLimitKey`, `checkRateLimit`, `rateLimitJsonResponse`, `resolveRequestLocale` — copy booking-create pattern.

Note: verify-email resend already has app-level `resend_too_soon` / `resend_limit` — keep those; add IP/account abuse layer in addition (or document if one subsumes the other; prefer **add** IP/account without removing existing).

## Research

- `findPortalUserByEmail` / `ByPhone` return blocked users (only filter `deletedAt`) — reset must check `blockedAt` explicitly; do not change find helpers globally in this feature (could surprise login paths that throw `AccountBlockedSignIn` separately).
- Jwt callback already excludes `blockedAt != null` users — portal-gate `blockedAt` is defense-in-depth + correct 403 when session id still present.
- Admin block “already blocked” short-circuit: no second `passwordChangedAt` bump required.
- Existing integration: `admin-audit.test.ts` blocks a masseur; extend rather than duplicate harness when possible.

## Quickstart / Testing Approach

```bash
npm run db:up
npm run db:test:prepare
# PowerShell:
$env:TEST_DATABASE_URL="postgresql://massage:massage@localhost:5432/massage_test?schema=public"
npm test
npm run typecheck
npm run lint
```

### Test map (pinning)

| Spec | Test |
|---|---|
| FR-1 / SC-1 / SC-6 | Integration: block bumps `passwordChangedAt`; `isJwtPasswordStale` true for pre-block stamp; comment/assert Session delete still happens |
| FR-4 / SC-2 | Unit or integration: `resolvePortalUser` / `requirePortalUser` rejects blocked → 403 when session id present; 401 when absent |
| FR-5 / SC-3 | Unit/integration: `createAndSendResetLink` blocked → no VerificationToken, sendEmail not called; `consumeResetToken` blocked → `invalid_token` |
| FR-3 / SC-4 | Unit on new `RATE_LIMITS` constants + at least one route/integration or rate-limit helper test proving 429 after exceed (gallery or resend) |
| FR-6 | Existing dual-session tests remain green (no behavior change) |
| SC-5 | Full `npm test` + lint + typecheck |

No new Playwright specs. Existing `e2e/admin-block-client.spec.ts` may keep passing without change.

### Rollout

- One or few PRs against a feature branch; link #177–#181; update #92 Phase 8 checkboxes when merging.
- No production enablement (constitution).

### Files likely touched

- `src/app/api/admin/users/[id]/block/route.ts`
- `src/lib/notifications/portal-gate.ts`
- `src/lib/email/password-reset.ts`
- `src/lib/rate-limit.ts`
- `src/app/api/masseur/gallery/route.ts`
- `src/app/api/masseur/availability/route.ts`
- `src/app/api/masseur/bookings/route.ts`
- `src/app/api/masseur/profile/route.ts`
- `src/app/api/client/profile/route.ts`
- `src/app/api/auth/verify-email/resend/route.ts`
- `tests/integration/admin-audit.test.ts` and/or new `admin-block-jwt.test.ts`
- `tests/unit` or `tests/integration` for portal-gate, password-reset blocked, rate-limit wiring
- Brief comment in block route (SC-6); optional one-line in `docs/business/user-roles.md` only if already describing block — avoid doc churn unless needed

## Where plan differs from a naive reading of issues

1. **#179** satisfied without proxy changes (per approved FR-2) — close with note that page path relies on JWT revoke + auth().
2. **portal-gate 401 vs 403** refined: session id present but DB rejects → 403; no session → 401 (so FR-4 is implementable with current Auth.js clearing).
'@

Approved: 2026-11-24

