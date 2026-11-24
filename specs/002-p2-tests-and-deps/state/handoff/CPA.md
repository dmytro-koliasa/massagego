# CPA — P2 stage merged and pinned (hand-off)

- When (UTC) / branch / commits: 2026-11-24 · `feat/002-p2-tests-and-deps` · 708ed88
- Built: pins in RESUME; lint fix for `data-hydrated` (`useSyncExternalStore`); IP rate-limit clears for smoke stability
- Measured:
  - `npm run typecheck` → exit 0
  - `npx eslint src tests e2e` → exit 0
  - `npm test` → 60 passed (earlier this session post-audit)
  - smoke file list → **8 passed** (~1.8m)
- Decided: clear shared IP rate-limit buckets in fixtures/register helper (not raise production limits)
- Deviations: supervisor.py not run (Windows fcntl — noted per card)
- Tried, did not work: `setHydrated` in `useEffect` (eslint `react-hooks/set-state-in-effect`)
- Left open / cards added to §5: (none)
- The next card must know: FR-1 file list matches disk; Prisma 7 = #193; ready for T009 SC table.

## Checks

| criterion | verdict | evidence | correction |
| --- | --- | --- | --- |
| Full check green | pass | typecheck + eslint + test + 8/8 smoke | |
| Pins in RESUME | pass | Pins section | |
| FR-1 list matches disk | pass | four new specs present | |
| Prisma 7 URL | pass | #193 | |
