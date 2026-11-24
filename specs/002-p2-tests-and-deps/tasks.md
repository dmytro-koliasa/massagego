# Tasks: P2 tests and deps

Design: [spec.md](spec.md) (FR-1–FR-7, NFR-1–NFR-5, SC-1–SC-6). Rationale: [plan.md](plan.md).
Constitution: [../constitution.md](../constitution.md). No new product UI / no ux.md (E2E drives existing screens).
This file is the **entry point of every working session**: one card (or one batch), one fresh session.

Format: `- [ ] T0nn [P] title — fulfills FR-…`. Every requirement maps to at least one card (§3).

**Lessons applied (from `specs/lessons.md` 001):**
1. T001 must record / require `TEST_DATABASE_URL` before E2E cards.
2. One commit per batch on Windows when sharing the integration tree.
3. Lint Verify = `npx eslint src tests e2e` (or CI-equivalent), not noisy repo-root `npm run lint` over `.cursor/skills`.
4. No Windows-native autopilot until supervisor fcntl fixed — hand-run cards; §6 still documents `--serve`.

**Where the cards differ from plan.md:**
1. Split E2E into two batches (masseur gallery+availability vs client register+delete) so batch size ≤ 4.
2. CI job + docs batched together (B3) after specs exist so the file list is real.
3. Audit (#186) is its own card after B3 so CPA sees lockfile + issue URL.
4. No CP0 — Open Questions empty. No `[P]` — sequential on one integration branch (Touches would collide on helpers/fixtures if parallelized carelessly; lessons favor sequential on Windows).

---

## 1. Session protocol (every card follows it)

1. **One card or one batch per session.** Open a fresh session for each card, or for each batch. First action: rename the session to `002 T0nn <card title>` (batch: `002 B<n> <name>`).
2. **Where things live.** State: `D:\projects\massage-app\specs\002-p2-tests-and-deps\state\` (`RESUME.md`, `handoff/`, `design-review.md`, `screens/`, `merge.lock`). Code in the main checkout on branch `feat/002-p2-tests-and-deps` (T001 creates branch; no extra worktree unless owner asks). Never `git stash` while another session works; save patches with `git diff` if needed.
3. **Start.** Read §1–§3 and your card; RESUME; dependency hand-offs; listed spec/plan sections; code **by symbol** (grep), never by line number.
   Path prefixes: `e2e/` = Playwright; `src/` = app (read-only unless a card explicitly needs a tiny hook); `docs/` = docs; `.github/workflows/` = CI.
   Verify: `npx playwright test <files>`; `npm test` when touching app; `npm run typecheck`; lint via `npx eslint src tests e2e`. Full check for checkpoints: `npm test` + typecheck + eslint scope above + smoke file list.
4. **Preconditions.** Dependencies `done` in RESUME. If not, write blocker and stop. Else set row to `doing` before work. **E2E cards require** `TEST_DATABASE_URL` pointing at `massage_test` and `npm run db:up` (or equivalent reachable Postgres).
5. **Stay in scope; one fix; checks fixed.** No silent constitution edits. No production enablement. No secrets/PII in logs. Never weaken tests to get green; only owner waives in RESUME. No `npm audit fix --force`. No Prisma 7 / next-auth leave-beta / breaking Blob major.
6. **Context budget.** If overloaded, split remainder to §5 (`T0nnB`) per skill rules; end with hand-off.
7. **Owner's yes.** New runtime dependencies, production/paid steps, force-push, `--force` audit — ask first. Prefer no new deps. Creating a GitHub issue for Prisma 7 is allowed without extra yes (FR-6).
8. **Project rules.** Constitution: stack lock, no PII, CI green, fixtures only.
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
# P2 tests and deps - resume

## Layout
(branch feat/002-p2-tests-and-deps; code map; baselines; TEST_DATABASE_URL status)

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
| FR-1 | CI e2e-smoke job (base + new specs) | T006, CPA |
| FR-2 | Gallery E2E happy path | T002 |
| FR-3 | Availability add E2E | T003 |
| FR-4 | Client register + delete E2E | T004, T005 |
| FR-5 | Reuse helpers/fixtures | T002–T005 (Never invent parallel stacks) |
| FR-6 | npm audit triage + safe fix + Prisma 7 issue | T008 |
| FR-7 | docs/testing.md CI vs local | T007 |
| NFR-1 | Chromium only; CI retries | T001 (confirm config), T006 |
| NFR-2 | Job ~25–30 min | T006 (`timeout-minutes: 30`) |
| NFR-3 | EMAIL_PROVIDER=log; fixtures; no PII | T006 + E2E cards Never |
| NFR-4 | Stack lock / no majors | T008 Never |
| NFR-5 | Separate CI job | T006 |
| SC-1 | Green e2e-smoke on PR | T006, T009 |
| SC-2 | Gallery E2E exists + passes | T002, T009 |
| SC-3 | Availability E2E exists + passes | T003, T009 |
| SC-4 | Client register + delete pass | T004, T005, T009 |
| SC-5 | Triage + safe fix + Prisma 7 issue | T008, T009 |
| SC-6 | docs/testing.md updated | T007, T009 |

Rules pinned by a test (Playwright specs are the pins for this feature):

| rule | pinning test | card |
| --- | --- | --- |
| Gallery upload→visible→delete | `e2e/masseur-gallery.spec.ts` | T002 |
| Availability add persists | `e2e/masseur-availability-add.spec.ts` | T003 |
| Client register happy path | `e2e/client-register.spec.ts` | T004 |
| Client delete happy path | `e2e/client-delete-account.spec.ts` | T005 |
| CI runs named smoke set | `.github/workflows/ci.yml` e2e-smoke job | T006 |

Success criteria measured by: SC-1–SC-6 → T009 (evidence from T002–T008 + CPA).

---

## 4. Cards

Checklist:

- [x] T001 Re-verify, branch, RESUME, code map
- [x] T002 Masseur gallery E2E — fulfills FR-2, SC-2
- [x] T003 Masseur availability-add E2E — fulfills FR-3, SC-3
- [x] B1 Masseur E2E (gallery + availability)
- [x] T004 Client register E2E — fulfills FR-4, SC-4
- [x] T005 Client delete-account E2E — fulfills FR-4, SC-4
- [x] B2 Client E2E (register + delete)
- [ ] T006 CI e2e-smoke job — fulfills FR-1, NFR-2, NFR-5, SC-1
- [ ] T007 Update docs/testing.md — fulfills FR-7, SC-6
- [ ] B3 CI smoke + docs
- [ ] T008 npm audit triage + safe fix + Prisma 7 issue — fulfills FR-6, SC-5
- [ ] CPA P2 stage merged and pinned
- [ ] T009 Close: results against success criteria
- [ ] CPEND Feature done

**Who may run beside whom:** none (sequential).

### Stage 1 — Re-verify and baseline

#### T001 — Re-verify, branch, RESUME, code map
fulfills baselines, NFR-1 check · after: — · M · effort high · kind fullstack

**Start with:** `P2 tests-and-deps · T001. Follow D:\projects\massage-app\specs\002-p2-tests-and-deps\tasks.md §1, then card T001.`
**Read:** plan.md (Technical Context, Files); spec.md FR-1–FR-7. Code by symbol: `playwright.config.ts` (`webServer`, `EMAIL_PROVIDER`, projects), `.github/workflows/ci.yml`, `storeUpload` / `usesBlobStorage`, `signInAsMasseur`, `signInAsClient`, `ensureBookingFixture`, `MasseurGallery`, `GalleryCropModal`, `DeleteAccountSection`, client register tab copy.
**Do:**
1. Create branch `feat/002-p2-tests-and-deps` from up-to-date `master`. Create `state/` + RESUME with a status row per §4 card (todo).
2. Code map in RESUME Layout: each plan symbol → file; confirm Chromium-only project; confirm local upload path when no Blob token; list exact base smoke filenames that exist today.
3. Baselines (read-only): whether `TEST_DATABASE_URL` is set; `npm run db:up` reachable if possible; note `npm audit --omit=dev` high count (command + total). Record Playwright version from package.json.
**Done when:** RESUME exists with all card rows; code map present; branch created; baselines recorded with commands; TEST_DATABASE_URL status explicit (set it in shell notes for next cards if missing).
**Verify:** `git status` on feature branch; RESUME path exists; no app commit.
**Touches:** `specs/002-p2-tests-and-deps/state/`, git branch only. **Never:** commit app/e2e code; print secrets; edit CI yet.

### Stage 2 — Masseur E2E

| batch | name | cards, in order | effort | Start with |
| --- | --- | --- | --- | --- |
| B1 | Masseur E2E (gallery + availability) | T002, T003 | high | `P2 tests-and-deps · B1. Follow D:\projects\massage-app\specs\002-p2-tests-and-deps\tasks.md §1, then the cards of batch B1 (Stage 2) in order.` |

#### T002 — Masseur gallery E2E
fulfills FR-2, FR-5, SC-2 · after: T001 · M · effort high · kind fullstack

**Start with:** `P2 tests-and-deps · T002. Follow D:\projects\massage-app\specs\002-p2-tests-and-deps\tasks.md §1, then card T002.`
**Read:** spec FR-2; plan gallery row; `MasseurGallery`, `GalleryCropModal`; `signInAsMasseur`; how `ensureBookingFixture` (or sibling) seeds a masseur; `storeUpload` local path.
**Do:**
1. Add a small PNG under `e2e/fixtures/` (or generate via script once) suitable for crop/upload.
2. Write `e2e/masseur-gallery.spec.ts`: seed/sign-in masseur → `/masseur/dashboard` → upload → complete crop modal if shown → assert image visible → delete with confirm → assert gone. EN|UK copy regexes.
3. Reuse helpers; add helper only if shared logic needs it. Ensure no `BLOB_READ_WRITE_TOKEN` required.
**Done when:** file exists; `npx playwright test e2e/masseur-gallery.spec.ts` exits 0 locally with TEST_DATABASE_URL.
**Verify:** that playwright command green; no real Resend/Blob.
**Touches:** `e2e/masseur-gallery.spec.ts`, `e2e/fixtures/*`, maybe `e2e/helpers/*`. **Never:** product redesign; masseur register flow; set Blob token in CI notes.

#### T003 — Masseur availability-add E2E
fulfills FR-3, FR-5, SC-3 · after: T002 · M · effort high · kind fullstack

**Start with:** `P2 tests-and-deps · T003. Follow D:\projects\massage-app\specs\002-p2-tests-and-deps\tasks.md §1, then card T003.`
**Read:** spec FR-3; plan availability; `masseur-availability-calendar` select/toggleSlot; `booking-masseur-slot-unavailable.spec.ts` as calendar interaction pattern; Save profile flow.
**Do:**
1. Write `e2e/masseur-availability-add.spec.ts`: seed masseur with known empty target hour → sign-in → click empty hour to make available → Save profile → reload (and next-week if fixture needs) → assert `.fc-event-available` (or equivalent) persists.
2. Prefer unique fixture suite name so it does not collide with booking fixtures.
**Done when:** file exists; playwright targeted run exits 0.
**Verify:** `npx playwright test e2e/masseur-availability-add.spec.ts` green.
**Touches:** `e2e/masseur-availability-add.spec.ts`, maybe `e2e/helpers/*`. **Never:** week-copy E2E; change calendar product behavior unless blocked (then stop and note §5 / design-review).

### Stage 3 — Client E2E

| batch | name | cards, in order | effort | Start with |
| --- | --- | --- | --- | --- |
| B2 | Client E2E (register + delete) | T004, T005 | high | `P2 tests-and-deps · B2. Follow D:\projects\massage-app\specs\002-p2-tests-and-deps\tasks.md §1, then the cards of batch B2 (Stage 3) in order.` |

#### T004 — Client register E2E
fulfills FR-4, FR-5, SC-4 · after: B1 (T003) · M · effort high · kind fullstack

**Start with:** `P2 tests-and-deps · T004. Follow D:\projects\massage-app\specs\002-p2-tests-and-deps\tasks.md §1, then card T004.`
**Read:** spec FR-4; `e2e/client-login.spec.ts` register-tab defaults; client register form fields/buttons (`Create account` / UK); validation schemas for required fields.
**Do:**
1. Write `e2e/client-register.spec.ts` with unique email/phone per run → fill register → submit → assert authenticated client shell (e.g. Sign out visible / `/client` URL).
2. EMAIL_PROVIDER=log already via Playwright webServer — do not hit Resend.
**Done when:** file exists; targeted playwright exits 0.
**Verify:** `npx playwright test e2e/client-register.spec.ts` green.
**Touches:** `e2e/client-register.spec.ts`, maybe helpers. **Never:** masseur register; exhaustive negative validation matrix.

#### T005 — Client delete-account E2E
fulfills FR-4, FR-5, SC-4 · after: T004 · M · effort high · kind fullstack

**Start with:** `P2 tests-and-deps · T005. Follow D:\projects\massage-app\specs\002-p2-tests-and-deps\tasks.md §1, then card T005.`
**Read:** `DeleteAccountSection`, i18n `deleteAccount*`; client profile route; soft-delete behavior (login after delete).
**Do:**
1. Write `e2e/client-delete-account.spec.ts`: create/sign-in a disposable client → open profile → Delete account → confirm → success toast → assert cannot usefully sign in again (or lands on deleted/blocked messaging consistent with app).
2. Reuse register helper from T004 if extracted; else seed via prisma like other ensure-* helpers.
**Done when:** file exists; targeted playwright exits 0.
**Verify:** `npx playwright test e2e/client-delete-account.spec.ts` green.
**Touches:** `e2e/client-delete-account.spec.ts`, maybe helpers. **Never:** masseur delete; production data.

### Stage 4 — CI smoke + docs

| batch | name | cards, in order | effort | Start with |
| --- | --- | --- | --- | --- |
| B3 | CI smoke + docs | T006, T007 | high | `P2 tests-and-deps · B3. Follow D:\projects\massage-app\specs\002-p2-tests-and-deps\tasks.md §1, then the cards of batch B3 (Stage 4) in order.` |

#### T006 — CI e2e-smoke job
fulfills FR-1, NFR-1–NFR-3, NFR-5, SC-1 · after: B2 (T005) · M · effort high · kind fullstack

**Start with:** `P2 tests-and-deps · T006. Follow D:\projects\massage-app\specs\002-p2-tests-and-deps\tasks.md §1, then card T006.`
**Read:** plan CI job; `.github/workflows/ci.yml`; `playwright.config.ts` port/env; list of new + base spec files.
**Do:**
1. Add separate job `e2e-smoke` (`timeout-minutes: 30`): Postgres service, `npm ci`, migrate test DB, `npx playwright install --with-deps chromium`, run **explicit** file list: base (`home` and/or `legal`, `client-login-success`, `masseur-login-success`, `booking-happy-path`) + the four new specs. Not full `e2e/`.
2. Env: `CI=true`, `EMAIL_PROVIDER=log`, `AUTH_SECRET` dummy, `AUTH_URL`/`BASE_URL` for `127.0.0.1:3001`, `DATABASE_URL`/`TEST_DATABASE_URL` to service. **Do not** set `BLOB_READ_WRITE_TOKEN`.
3. Keep `lint-and-test` unchanged.
**Done when:** workflow YAML contains the job with explicit files; local dry-run of the same file list still green when DB up.
**Verify:** re-read YAML; `npx playwright test <same list>` green locally if feasible.
**Touches:** `.github/workflows/ci.yml`. **Never:** full e2e on every PR; paid runners; Firefox/WebKit.

#### T007 — Update docs/testing.md
fulfills FR-7, SC-6 · after: T006 · S · effort medium · kind fullstack

**Start with:** `P2 tests-and-deps · T007. Follow D:\projects\massage-app\specs\002-p2-tests-and-deps\tasks.md §1, then card T007.`
**Read:** `docs/testing.md` CI + E2E sections; hand-off T006 for exact job name and file list.
**Do:** Document e2e-smoke vs local full `npm run test:e2e`; update “Not in CI” / steps table so they match reality.
**Done when:** docs state CI runs named smoke set; full suite remains local-oriented.
**Verify:** read-back of the CI section matches `ci.yml`.
**Touches:** `docs/testing.md`. **Never:** invent nightly schedule.

### Stage 5 — Audit

#### T008 — npm audit triage + safe fix + Prisma 7 issue
fulfills FR-6, NFR-4, SC-5 · after: B3 (T007) · M · effort medium · kind fullstack

**Start with:** `P2 tests-and-deps · T008. Follow D:\projects\massage-app\specs\002-p2-tests-and-deps\tasks.md §1, then card T008.`
**Read:** spec FR-6; plan Audit; current `npm audit --omit=dev`.
**Do:**
1. Write triage (hand-off and/or GitHub issue body): each high finding — reachable? fix path? deferred?
2. Run `npm audit fix` **without** `--force`. Commit lockfile only if tests/typecheck still green and no major bumps.
3. `gh issue create` for Prisma 7 upgrade; note deferred Blob/zod nesting and next-auth beta stay; link #186 / #92 as appropriate.
**Done when:** triage recorded; Prisma 7 issue URL in hand-off; no `--force` used; app still typechecks if lockfile changed.
**Verify:** `npm audit --omit=dev` (remaining expected); `npm run typecheck` if lockfile touched; issue URL opens.
**Touches:** `package-lock.json` (maybe `package.json` only if safe non-major), hand-off, GitHub issue. **Never:** Prisma 7 install; `audit fix --force`; leave next-auth beta.

### Stage 6 — Checkpoint

#### CPA — P2 stage merged and pinned
after: T002–T008 · S · effort high · kind fullstack

**Start with:** `P2 tests-and-deps · CPA. Follow D:\projects\massage-app\specs\002-p2-tests-and-deps\tasks.md §1, then card CPA.`
**Read:** RESUME; hand-offs T002–T008; plan Testing Approach.
**Do:** Checkpoint routine. Pins: four new e2e files + ci.yml smoke list. Full check: `npm test`, `npm run typecheck`, `npx eslint src tests e2e`, and playwright smoke file list. Review diff; §5 only for confirmed findings. Record Prisma 7 issue URL. Batch any §5 small cards.
**Done when:** green; pins listed in RESUME; FR-1 file list matches disk.
**Verify:** commands above; supervisor.py if runnable (may fail on Windows fcntl — note and continue).
**Touches:** whole feature branch / state / possibly §5. **Never:** production deploy; expand smoke to full e2e.

### Close

#### T009 — Results
after: CPA, §5 · M · effort medium · kind fullstack

**Start with:** `P2 tests-and-deps · T009. Follow D:\projects\massage-app\specs\002-p2-tests-and-deps\tasks.md §1, then card T009.`
**Read:** spec Success Criteria; hand-offs T002–T008; CPA.
**Do:** Checks table for SC-1–SC-6 with commands/evidence. Note #182–#186 closable after merge (owner closes if required).
**Done when:** every SC has a row with evidence.
**Verify:** re-run cited commands where cheap; match hand-off numbers/URLs.
**Touches:** `state/handoff/T009.md`, RESUME row.

#### CPEND — Feature done
after: T009 · S · effort low · kind fullstack

**Start with:** `P2 tests-and-deps · CPEND. Follow D:\projects\massage-app\specs\002-p2-tests-and-deps\tasks.md §1, then card CPEND.`
**Read:** RESUME; T009; `specs/lessons.md`.
**Do:** All cards ticked/waived; locks free. Retro: append dated section to `specs/lessons.md` (supervisor `--lessons` if available; else manual table like 001). Tell owner: PR + merge, close #182–#186, update #92 Phase 8; then P3.
**Done when:** lessons section written; feature complete except owner merge.
**Verify:** `specs/lessons.md` has today’s 002 section.
**Touches:** `state/`, `specs/lessons.md`.

---

## 5. Backlog (cards added during execution)

### Batches

(ids continue after B3)

- (none yet)

| batch | name | cards, in order | effort | Start with |
| --- | --- | --- | --- | --- |

---

## 6. Supervisor

**Start with:** `P2 tests-and-deps · SUP. Follow D:\projects\massage-app\specs\002-p2-tests-and-deps\tasks.md §6.`

**Autopilot:** owner runs in their own terminal (prefer WSL until Windows fcntl fixed):
`python D:\projects\massage-app\.cursor\skills\spec-grill\hooks\supervisor.py D:\projects\massage-app\specs\002-p2-tests-and-deps\tasks.md --serve --autopilot --open`
**Runs as:** (owner’s Claude CLI account)
**App URL:** http://localhost:3000
**Never unattended:** `Bash(git push:*)`, production deploy, paid cloud CLIs, `Bash(npm publish:*)`, `Bash(npm audit fix --force*)`

1. Rename session to `002 Supervisor`.
2. Read-only except `state/.supervisor.json` via the script.
3. Before every answer run supervisor.py on this tasks.md.
4. Stay armed with `--wait` when available.
5. Report changes; never start card sessions if autopilot is on.
