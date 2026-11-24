# CPA — Hardening stage merged and pinned (hand-off)
- When (UTC) / branch / commits: 2026-11-24 / feat/001-p1-blocked-access-hardening / (CPA commit)
- Built: checkpoint review; pins recorded in RESUME; no §5 cards
- Measured:
  - `npm test` → unit+integration green (integration 23 files / 60 tests)
  - pinning re-run: portal-gate, auth-password-reset-origin, password-reset-blocked-confirm, gallery-rate-limit-route, admin-block-jwt — all pass
  - `npm run typecheck` green
  - `npm run lint -- src tests` green
- Decided: no §5 findings; FR-2 proxy untouched confirmed
- Deviations: supervisor.py unavailable on Windows (`fcntl`); skipped
- Tried, did not work: (none)
- Left open: (none)
- The next card must know: T007 measures SC-1–SC-6 from hand-offs; then CPEND; owner merges + closes #177–#181

## Checks
| criterion | verdict | evidence | correction |
| --- | --- | --- | --- |
| Full npm test green | pass | exit 0; integration 60 passed | |
| typecheck + lint src/tests | pass | exit 0 | |
| FR-2 proxy untouched | pass | no `blockedAt` in proxy.ts; `git diff master -- src/proxy.ts` empty | |
| Pins listed | pass | RESUME Pins section | |
| No unexpected §5 | pass | none added | |
