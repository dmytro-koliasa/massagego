# Tasks: P1 blocked-access hardening

Design: [spec.md](spec.md) (FR-1–FR-6, NFR-1–NFR-4, SC-1–SC-6). Rationale: [plan.md](plan.md).
Constitution: [../constitution.md](../constitution.md). No UI / no ux.md.
This file is the **entry point of every working session**: one card (or one batch), one fresh session.

Format: `- [ ] T0nn [P] title — fulfills FR-…`. Every requirement maps to at least one card (§3).

**Where the cards differ from plan.md:**
1. Split rate-limit **wiring** (T005) from rate-limit **proof test** (T006) so SC-4 evidence is explicit.
2. No CP0 — spec Open Questions empty.
3. No worktree parallel `[P]` batches — Touches overlap on shared auth helpers; run sequential on one integration branch.

---

## 1. Session protocol (every card follows it)

1. **One card or one batch per session.** Open a fresh session for each card, or for each batch. First action: rename the session to `001 T0nn <card title>` (batch: `001 B<n> <name>`).
2. **Where things live.** State: `D:\projects\massage-app\specs\001-p1-blocked-access-hardening\state\` (`RESUME.md`, `handoff/`, `design-review.md`, `screens/`, `merge.lock`). Code in the main checkout on branch `feat/001-p1-blocked-access-hardening` (T001 creates branch; no extra worktree unless owner asks). Never `git stash` while another session works; save patches with `git diff` if needed. Hold `state/merge.lock` only if a parallel worktree is later introduced.
3. **Start.** Read §1–§3 and your card; RESUME; dependency hand-offs; listed spec/plan sections; code **by symbol** (grep), never by line number.
   Path prefixes: `src/` = app code; `tests/unit/`, `tests/integration/` = Vitest.
   Verify: `npm run test:unit`, `npm run test:integration` (needs `TEST_DATABASE_URL`), `npm run typecheck`, `npm run lint`. Full check: `npm test` then typecheck + lint.
4. **Preconditions.** Dependencies `done` in RESUME. If not, write blocker and stop. Else set row to `doing` before work.
5. **Stay in scope; one fix; checks fixed.** No silent constitution edits. No production enablement. No secrets/PII in logs. Never weaken tests to get green; only owner waives in RESUME.
6. **Context budget.** If overloaded, split remainder to §5 (`T0nnB`) per skill rules; end with hand-off.
7. **Owner's yes.** New runtime dependencies, production/paid steps, force-push — ask first. Prefer no new deps for this feature.
8. **Project rules.** Constitution: account safety, portal isolation, stack lock, no PII in logs.
9. **Finish.** Run Verify + full check (batch: per-card fast checks, full check once at end); commit conventional message on feature branch; write hand-off; tick card; update RESUME; stop.

## 2. Templates

**Hand-off note** — `state/handoff/T0nn.md` (≤ 60 lines):

```markdown
# T0nn — <title> (hand-off)
- When (UTC) / branch / commits:
- Built:
- Measured:
- Decided:
- Deviations:
- Tried, did not work:
- Left open / cards added to §5:
- The next card must know (≤ 10 lines):

## Checks
| criterion | verdict | evidence | correction |
| --- | --- | --- | --- |
| <each Done when line> | pass / fail / unresolved | <cmd/output or path> | <fix or why open> |
```

**RESUME** — created by T001 from this skeleton:

```markdown
# P1 blocked-access hardening - resume

## Layout
(branch feat/001-p1-blocked-access-hardening; code map; baselines)

## Pins
(pins listed by CPA)

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
```

## 3. Traceability (spec requirement → cards)

| id | requirement | cards |
| --- | --- | --- |
| FR-1 | Block bumps `passwordChangedAt` | T002, CPA |
| FR-2 | No proxy DB for block | T001 (verify), CPA |
| FR-3 | Rate limits on listed writes | T005, T006 |
| FR-4 | `requirePortalUser` rejects blocked; 403/401 | T003 |
| FR-5 | Reset/reclaim blocked safe | T004 |
| FR-6 | `X-Portal` unchanged | T003, CPA |
| NFR-1 | No PII in logs | T002–T006 (Never) |
| NFR-2 | No proxy DB; reuse rate-limit buckets | T001, T005 |
| NFR-3 | Portal isolation preserved | T003, CPA |
| NFR-4 | Tests fail if check removed | T002–T006 |
| SC-1 | Block → stale JWT / API reject | T002, T007 |
| SC-2 | Shared route 403 for blocked | T003, T007 |
| SC-3 | Reset blocked → no token/mail | T004, T007 |
| SC-4 | 429 after exceed + scopes wired | T005, T006, T007 |
| SC-5 | CI-equivalent green; issues closable | CPA, T007 |
| SC-6 | Document JWT revoke ≠ Session | T002, T007 |

Rules pinned by a test:

| rule | pinning test | card |
| --- | --- | --- |
| Block bumps passwordChangedAt / JWT stale | `tests/integration/admin-block-jwt.test.ts` (new or extend audit) | T002 |
| requirePortalUser rejects blocked | `tests/unit/portal-gate-blocked.test.ts` (or integration) | T003 |
| Reset blocked: no token/send; confirm invalid_token | `tests/unit` or `tests/integration` password-reset blocked | T004 |
| New rate-limit scope returns 429 when exceeded | unit/integration covering one FR-3 scope | T006 |

Success criteria measured by: SC-1–SC-6 → T007 (evidence from T002–T006 hand-offs + re-run commands).

---

## 4. Cards

Checklist:

- [x] T001 Re-verify, branch, RESUME, code map
- [x] T002 Admin block bumps passwordChangedAt — fulfills FR-1, SC-1, SC-6
- [x] T003 requirePortalUser rejects blocked — fulfills FR-4, FR-6, SC-2
- [x] T004 Password reset/reclaim ignores blocked — fulfills FR-5, SC-3
- [x] B1 Block path + gates + reset
- [x] T005 Wire FR-3 rate limits on write routes — fulfills FR-3
- [x] T006 Prove rate-limit 429 for a new scope — fulfills FR-3, SC-4
- [x] B2 Rate limits
- [x] CPA Hardening stage merged and pinned
- [ ] T007 Close: results against success criteria
- [ ] CPEND Feature done

**Who may run beside whom:** none (sequential).

### Stage 1 — Re-verify and baseline

#### T001 — Re-verify, branch, RESUME, code map
fulfills baselines, FR-2 check · after: — · M · effort high · kind fullstack

**Start with:** `P1 blocked-access · T001. Follow D:\projects\massage-app\specs\001-p1-blocked-access-hardening\tasks.md §1, then card T001.`
**Read:** plan.md (Technical Context, Files); spec.md FR-1–FR-6. Code by symbol: `requirePortalUser`, `resolvePortalUser`, `POST` block route, `createAndSendResetLink`, `consumeResetToken`, `RATE_LIMITS`, `applyPasswordVersionToJwt`, `isJwtPasswordStale`.
**Do:**
1. Create branch `feat/001-p1-blocked-access-hardening` from up-to-date `master` (or current default). Create `state/` + RESUME with a status row per §4 card (todo).
2. Code map: locate each plan symbol → file as of today; note if proxy has any blockedAt check (must remain absent per FR-2).
3. Baselines (read-only): `npm run test:unit` exit code; note whether `TEST_DATABASE_URL` is set for integration.
**Done when:** RESUME exists with all card rows; code map in RESUME Layout; FR-2 confirmed (no proxy DB plan); branch created; baselines recorded with commands.
**Verify:** no production writes; `git status` shows branch; RESUME path exists under feature `state/`.
**Touches:** `specs/001-p1-blocked-access-hardening/state/`, git branch only. **Never:** commit app code; print secrets; edit `proxy.ts`.

### Stage 2 — Block path, portal gate, reset (end-to-end security behaviors)

| batch | name | cards, in order | effort | Start with |
| --- | --- | --- | --- | --- |
| B1 | Block path + gates + reset | T002, T003, T004 | high | `P1 blocked-access · B1. Follow D:\projects\massage-app\specs\001-p1-blocked-access-hardening\tasks.md §1, then the cards of batch B1 (Stage 2) in order.` |

#### T002 — Admin block bumps passwordChangedAt
fulfills FR-1, SC-1, SC-6 · after: T001 · M · effort high · kind backend

**Start with:** `P1 blocked-access · T002. Follow D:\projects\massage-app\specs\001-p1-blocked-access-hardening\tasks.md §1, then card T002.`
**Read:** spec FR-1, SC-1, SC-6; plan Admin block. Code: block `POST` handler; `isJwtPasswordStale` / `passwordChangedAtMs`; pattern in `tests/integration/admin-password-change-jwt.test.ts` and `admin-audit.test.ts`.
**Do:**
1. In block transaction, set `passwordChangedAt` together with `blockedAt` (same timestamp OK).
2. Comment that JWT revoke is `passwordChangedAt`, not `Session.deleteMany` (keep deleteMany).
3. Add/extend integration test: after block, `passwordChangedAt` set; pre-block JWT stamp is stale via `isJwtPasswordStale`.
**Done when:** block updates both fields; test fails if `passwordChangedAt` bump removed; SC-6 comment present.
**Verify:** `npm run test:integration` (or targeted file) green; show failing mutation locally then restore.
**Touches:** `src/app/api/admin/users/[id]/block/route.ts`, `tests/integration/admin-block-jwt.test.ts` and/or `admin-audit.test.ts`. **Never:** log PII; change unblock semantics beyond necessity.

#### T003 — requirePortalUser rejects blocked
fulfills FR-4, FR-6, SC-2 · after: T002 · M · effort high · kind backend

**Start with:** `P1 blocked-access · T003. Follow D:\projects\massage-app\specs\001-p1-blocked-access-hardening\tasks.md §1, then card T003.`
**Read:** spec FR-4, FR-6; plan portal-gate. Code: `resolvePortalUser`, `requirePortalUser`; compare `requireClientSession` / `userHasPortal`.
**Do:**
1. Require `blockedAt: null` (and keep `deletedAt` null / portal match).
2. If portal session has `user.id` but resolve fails → **403 forbidden**; if no session id → **401 unauthorized**; keep `ambiguous_portal` / hint behavior.
3. Unit/integration test: blocked user rejected; test fails if `blockedAt` check removed.
**Done when:** FR-4 statuses hold; FR-6 dual-session still works (existing tests or minimal assert); pinning test green.
**Verify:** targeted vitest + any existing portal dual-session test still green.
**Touches:** `src/lib/notifications/portal-gate.ts`, new/extended test under `tests/`. **Never:** move module to new path (#187); change cookie names.

#### T004 — Password reset/reclaim ignores blocked
fulfills FR-5, SC-3 · after: T003 · M · effort high · kind backend

**Start with:** `P1 blocked-access · T004. Follow D:\projects\massage-app\specs\001-p1-blocked-access-hardening\tasks.md §1, then card T004.`
**Read:** spec FR-5, SC-3; plan Password reset; `tests/unit/auth-password-reset-origin.test.ts`, `tests/integration/email-reclaim.test.ts`.
**Do:**
1. `createAndSendResetLink`: if `user.blockedAt` → `{ ok: true }` with no token write / no send.
2. `consumeResetToken`: if user `blockedAt` → `invalid_token` (cleanup tokens OK).
3. Tests covering request (no token/send) and confirm (`invalid_token`).
**Done when:** SC-3 observable in tests; enumeration-safe response unchanged for request.
**Verify:** targeted vitest green; mutation removing blocked check fails a test.
**Touches:** `src/lib/email/password-reset.ts`, tests under `tests/unit` and/or `tests/integration`. **Never:** log email/token; change findPortalUser* globally.

### Stage 3 — Rate limits

| batch | name | cards, in order | effort | Start with |
| --- | --- | --- | --- | --- |
| B2 | Rate limits | T005, T006 | high | `P1 blocked-access · B2. Follow D:\projects\massage-app\specs\001-p1-blocked-access-hardening\tasks.md §1, then the cards of batch B2 (Stage 3) in order.` |

#### T005 — Wire FR-3 rate limits on write routes
fulfills FR-3 · after: T004 · M · effort high · kind backend

**Start with:** `P1 blocked-access · T005. Follow D:\projects\massage-app\specs\001-p1-blocked-access-hardening\tasks.md §1, then card T005.`
**Read:** spec FR-3 table; plan Rate limits; `RATE_LIMITS` + booking create route as pattern; gallery, availability, masseur bookings, client/masseur profile, verify-email resend routes.
**Do:**
1. Add FR-3 entries to `RATE_LIMITS`.
2. Apply IP + account checks on listed routes (POST/PUT as specified); keep existing verify resend limits and add abuse layer.
**Done when:** all FR-3 scopes exist in `RATE_LIMITS` and are called from the listed routes.
**Verify:** `npm run typecheck`; unit import of new keys; smoke that handlers still export.
**Touches:** `src/lib/rate-limit.ts`, gallery/availability/masseur bookings/profile routes, client profile, verify-email resend. **Never:** change Nominatim global limit; remove existing resend_too_soon logic.

#### T006 — Prove rate-limit 429 for a new scope
fulfills FR-3, SC-4 · after: T005 · S · effort medium · kind backend

**Start with:** `P1 blocked-access · T006. Follow D:\projects\massage-app\specs\001-p1-blocked-access-hardening\tasks.md §1, then card T006.`
**Read:** hand-off T005; existing `tests/unit/rate-limit*.ts` / route tests.
**Do:** Add test that exceeds one new scope (prefer gallery or verify-resend) and expects 429 / rate-limit response; document that all scopes are wired (T005).
**Done when:** SC-4 evidence in Checks table; test fails if limit check removed from that route/helper.
**Verify:** targeted vitest green.
**Touches:** `tests/unit` or `tests/integration` rate-limit/route tests. **Never:** flake with real sleep longer than needed — prefer injecting limit=1 or helper-level test.

#### CPA — Hardening stage merged and pinned
after: T002–T006 · S · effort high · kind fullstack

**Start with:** `P1 blocked-access · CPA. Follow D:\projects\massage-app\specs\001-p1-blocked-access-hardening\tasks.md §1, then card CPA.`
**Read:** RESUME; hand-offs T002–T006; plan Testing Approach.
**Do:** Checkpoint routine (no `[P]` branches expected). Pins: the four pinning tests in §3. Confirm `proxy.ts` untouched. Full `npm test` + typecheck + lint. Review diff; §5 only for confirmed findings. Batch any §5 small cards.
**Done when:** green; pins listed; FR-2 confirmed; drift clean in supervisor when available.
**Verify:** `npm test`; `npm run typecheck`; `npm run lint`; `python D:\projects\massage-app\.cursor\skills\spec-grill\hooks\supervisor.py D:\projects\massage-app\specs\001-p1-blocked-access-hardening\tasks.md` (or `python3`) shows no unexpected drift.
**Touches:** whole feature branch / state / possibly §5. **Never:** production deploy.

### Close

#### T007 — Results
after: CPA, §5 · M · effort medium · kind fullstack

**Start with:** `P1 blocked-access · T007. Follow D:\projects\massage-app\specs\001-p1-blocked-access-hardening\tasks.md §1, then card T007.`
**Read:** spec Success Criteria; hand-offs T002–T006; CPA.
**Do:** Checks table for SC-1–SC-6 with commands/evidence. Note GitHub issues #177–#181 ready to close after merge (do not close without owner if policy requires).
**Done when:** every SC has a row with evidence.
**Verify:** re-run cited commands; match hand-off numbers.
**Touches:** `state/handoff/T007.md` only (plus RESUME row).

#### CPEND — Feature done
after: T007 · S · effort low · kind fullstack

**Start with:** `P1 blocked-access · CPEND. Follow D:\projects\massage-app\specs\001-p1-blocked-access-hardening\tasks.md §1, then card CPEND.`
**Read:** RESUME; T007; `specs/lessons.md` if present.
**Do:** All cards ticked/waived; locks free. Retro: run supervisor `--lessons` and append dated section to `specs/lessons.md` (create if missing). Tell owner: merge PR, close #177–#181, update #92 Phase 8; then P2.
**Done when:** lessons section written; supervisor shows all but CPEND done.
**Verify:** supervisor report; `specs/lessons.md` has today’s section.
**Touches:** `state/`, `specs/lessons.md`.

---

## 5. Backlog (cards added during execution)

### Batches

(ids continue after B2)

- (none yet)

| batch | name | cards, in order | effort | Start with |
| --- | --- | --- | --- | --- |

---

## 6. Supervisor

**Start with:** `P1 blocked-access · SUP. Follow D:\projects\massage-app\specs\001-p1-blocked-access-hardening\tasks.md §6.`

**Autopilot:** owner runs in their own terminal:
`python D:\projects\massage-app\.cursor\skills\spec-grill\hooks\supervisor.py D:\projects\massage-app\specs\001-p1-blocked-access-hardening\tasks.md --serve --autopilot --open`
**Runs as:** (owner’s Claude CLI account)
**App URL:** http://localhost:3000
**Never unattended:** `Bash(git push:*)`, production deploy, paid cloud CLIs, `Bash(npm publish:*)`

1. Rename session to `001 Supervisor`.
2. Read-only except `state/.supervisor.json` via the script.
3. Before every answer run supervisor.py on this tasks.md.
4. Stay armed with `--wait` when available.
5. Report changes; never start card sessions if autopilot is on.
'@
