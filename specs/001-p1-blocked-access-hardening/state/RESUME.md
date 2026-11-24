# P1 blocked-access hardening - resume

State file for the one-card-per-session protocol in
`D:\projects\massage-app\specs\001-p1-blocked-access-hardening\tasks.md` (§1).

## Layout

- **Branch:** `feat/001-p1-blocked-access-hardening`
- **Worktree:** main checkout only
- **FR-2:** `src/proxy.ts` untouched (no `blockedAt`)

### Code map (T001) — still accurate; T002–T004 landed

See hand-offs T002–T004 for deltas.

### Baselines (T001)

| Check | Command | Result |
| --- | --- | --- |
| Unit tests | `npm run test:unit` | exit 0 — 42 files / 235 tests (pre-B1) |
| B1 full tests | `npm test` with TEST_DATABASE_URL | unit + integration green (2026-11-24) |
| typecheck | `npm run typecheck` | green |
| lint src/tests | `npm run lint -- src tests` | green (repo-root `npm run lint` still noisy on `.cursor/skills`) |

## Pins

(none yet — CPA)

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
| T002 | Admin block bumps passwordChangedAt | done | feat/001-p1-blocked-access-hardening | (B1) | 2026-11-24 |
| T003 | requirePortalUser rejects blocked | done | feat/001-p1-blocked-access-hardening | (B1) | 2026-11-24 |
| T004 | Password reset/reclaim ignores blocked | done | feat/001-p1-blocked-access-hardening | (B1) | 2026-11-24 |
| B1 | Block path + gates + reset | done | feat/001-p1-blocked-access-hardening | (B1) | 2026-11-24 |
| T005 | Wire FR-3 rate limits | todo | | | |
| T006 | Prove rate-limit 429 | todo | | | |
| B2 | Rate limits | todo | | | |
| CPA | Hardening stage merged and pinned | todo | | | |
| T007 | Results | todo | | | |
| CPEND | Feature done | todo | | | |
