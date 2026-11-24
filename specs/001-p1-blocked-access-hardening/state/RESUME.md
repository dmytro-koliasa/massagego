# P1 blocked-access hardening - resume

State file for the one-card-per-session protocol in
`D:\projects\massage-app\specs\001-p1-blocked-access-hardening\tasks.md` (§1).

## Layout

- **Branch:** `feat/001-p1-blocked-access-hardening`
- **Worktree:** main checkout only
- **FR-2:** `src/proxy.ts` untouched (no `blockedAt`) — reconfirmed at CPA

### Baselines (T001)

| Check | Command | Result |
| --- | --- | --- |
| Unit tests | `npm run test:unit` | exit 0 (pre-B1 baseline) |
| CPA full suite | `npm test` + typecheck + `eslint src tests` | exit 0 (2026-11-24) |

## Pins

| rule | pinning test | card |
| --- | --- | --- |
| Block bumps passwordChangedAt / JWT stale | `tests/integration/admin-block-jwt.test.ts` | T002 |
| requirePortalUser rejects blocked | `tests/unit/portal-gate.test.ts` | T003 |
| Reset blocked: no token/send; confirm invalid_token | `tests/unit/auth-password-reset-origin.test.ts`, `tests/unit/password-reset-blocked-confirm.test.ts` | T004 |
| New rate-limit scope returns 429 | `tests/unit/gallery-rate-limit-route.test.ts` | T006 |

Pins reviewed up to CPA (HEAD after CPA commit).

## Deploy lock

free

## Switch states

(n/a)

## Decisions (spec Open Questions)

| # | question | recommended | needed before | answer | by, when |
| --- | --- | --- | --- | --- | --- |

## Approvals

| # | card | step | why | status | answer |
| --- | --- | --- | --- | --- | --- |

## Blockers

- (none)

## Status

| card | title | status | branch | commit | date (UTC) |
| --- | --- | --- | --- | --- | --- |
| T001 | Re-verify, branch, RESUME, code map | done | feat/001-p1-blocked-access-hardening | (no commit) | 2026-11-24 |
| T002 | Admin block bumps passwordChangedAt | done | feat/001-p1-blocked-access-hardening | 7aa3c8a | 2026-11-24 |
| T003 | requirePortalUser rejects blocked | done | feat/001-p1-blocked-access-hardening | 7aa3c8a | 2026-11-24 |
| T004 | Password reset/reclaim ignores blocked | done | feat/001-p1-blocked-access-hardening | 7aa3c8a | 2026-11-24 |
| B1 | Block path + gates + reset | done | feat/001-p1-blocked-access-hardening | 7aa3c8a | 2026-11-24 |
| T005 | Wire FR-3 rate limits | done | feat/001-p1-blocked-access-hardening | 75d5089 | 2026-11-24 |
| T006 | Prove rate-limit 429 | done | feat/001-p1-blocked-access-hardening | 75d5089 | 2026-11-24 |
| B2 | Rate limits | done | feat/001-p1-blocked-access-hardening | 75d5089 | 2026-11-24 |
| CPA | Hardening stage merged and pinned | done | feat/001-p1-blocked-access-hardening | (CPA) | 2026-11-24 |
| T007 | Results | todo | | | |
| CPEND | Feature done | todo | | | |
