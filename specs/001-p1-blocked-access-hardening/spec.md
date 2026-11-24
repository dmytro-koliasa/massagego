# Spec: P1 blocked-access hardening

Issues: #177–#181 · Parent: #92 Phase 8 · Constitution: ../constitution.md

## User Scenarios

1. **Admin blocks a client or masseur** — after block, that account’s JWTs are immediately useless because `passwordChangedAt` is bumped with `blockedAt`.
2. **Blocked user calls shared portal APIs** (`requirePortalUser`: inbox, prefs, Telegram account routes, complaints, account delete, geocode, verify-email resend) — request rejected, not served.
3. **Blocked user opens protected pages** — once JWT/`auth()` clears, treated as logged-out (redirect/login). No new proxy DB check; short stale-cookie window in `getToken` accepted.
4. **Abuse pressure** on gallery upload, availability writes, masseur walk-in create, profile writes, verify-email resend — rate limited with 429 after thresholds.
5. **Blocked user requests password reset/reclaim** — same enumeration-safe `{ ok: true }` as unknown account; no VerificationToken row; no email.

Actors: Admin, Client, Masseur, anonymous/attacker (rate limits).

## Functional Requirements

- **FR-1:** On admin block, in the same transaction as setting `blockedAt`, bump `passwordChangedAt` so JWTs fail the existing #79 version check. Document that `Session.deleteMany` is not the JWT revoke mechanism.
- **FR-2:** Do not add `blockedAt` DB lookups to `proxy.ts` in this feature. Page safety relies on JWT version invalidation + existing `auth()` / page gates.
- **FR-3:** Add rate limits (IP + account, hashed keys, existing response helpers):

| Scope | IP | Account | Window |
|---|---|---|---|
| Gallery upload | 20 | 10 | 15 min |
| Availability POST/PUT | 60 | 60 | 15 min |
| Walk-in booking create | 30 | 30 | 15 min |
| Profile write (client + masseur) | 30 | 20 | 15 min |
| Verify-email resend | 5 | 5 | 1 hour |

- **FR-4:** `requirePortalUser` must reject users with `blockedAt` or `deletedAt` set — **403 `forbidden`** when a session is present, **401 `unauthorized`** when not (aligned with client/masseur gates).
- **FR-5:** Password-reset **request** for blocked accounts: `{ ok: true }`, no token, no email. Password-reset **confirm**: if account is blocked, behave as **`invalid_token`** (do not reveal blocked).
- **FR-6:** Keep dual-session `X-Portal` / `ambiguous_portal` behavior unchanged.

## Experience

None — no new screens. Reuse existing 401/403/429 handling and login redirects.

## Non-Functional Requirements

- **NFR-1 Security:** Fail-closed; no secrets/PII in logs (constitution).
- **NFR-2 Perf:** No new DB round-trip in `proxy.ts` for block; reuse Postgres rate-limit buckets.
- **NFR-3 Compat:** Portal isolation and `X-Portal` semantics preserved.
- **NFR-4 Testability:** Each FR has unit/integration coverage that fails if the new check is removed.

## Success Criteria

- **SC-1:** After block, victim’s next authenticated API call is 401/403; DB `passwordChangedAt` newer than pre-block JWT stamp. (FR-1)
- **SC-2:** Blocked user on a `requirePortalUser` route gets 403; test fails if `blockedAt` check removed. (FR-4)
- **SC-3:** Reset request for blocked → `{ ok: true }`, zero new tokens, zero sends. (FR-5)
- **SC-4:** At least one new rate-limit scope demonstrates 429 after exceeding limit in tests; all FR-3 scopes wired in code. (FR-3)
- **SC-5:** `npm test` + lint/typecheck green; #177–#181 closable. (NFR-4)
- **SC-6:** Block path documents JWT revoke via `passwordChangedAt`, not Session rows. (FR-1)

## Out of Scope

- P0 host/email/cron/legal (#173–#176, #89)
- Proxy DB `blockedAt` check; shortening JWT maxAge
- New `credentialsRevokedAt` (or similar) column
- Explicit API error code `"blocked"`
- Unblock-specific UX; new E2E beyond existing admin-block coverage
- P2 E2E-in-CI / gallery / availability / register E2E (#182–#185)
- P3 god-component / i18n / moving `portal-gate` module (#187)
- P4 landing/typography/header (#188–#190)
- P5 backlog (#191); Prisma 7; leaving next-auth beta

## Open Questions

(none)

Approved: 2026-11-24

