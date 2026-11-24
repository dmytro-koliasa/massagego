# Lessons

## 2026-11-24 — 001-p1-blocked-access-hardening

Measured (manual / no supervisor `--lessons` on Windows — `fcntl` missing):

| card / batch | kind | size | effort | notes |
| --- | --- | --- | --- | --- |
| T001 | fullstack | M | high | baseline only; no app commit |
| B1 (T002–T004) | backend | M×3 | high | one commit; integration needed TEST_DATABASE_URL |
| B2 (T005–T006) | backend | M+S | high | shared `enforceIpAccountRateLimit` paid off |
| CPA | fullstack | S | high | green; supervisor skipped on Win |
| T007 / CPEND | fullstack | M+S | medium/low | close |

What to do differently next feature:

1. Set `TEST_DATABASE_URL` in the first card session — T001 noted it unset and B1 almost stumbled.
2. Prefer one commit per batch on Windows when cards share a working tree (B1/B2) — splitting mid-batch commits is awkward after parallel edits.
3. `npm run lint` at repo root still fails on `.cursor/skills`; always scope `eslint src tests` (or fix eslintignore) so CPA Verify matches CI.
4. supervisor/autopilot needs WSL or a non-fcntl lock — don't plan Windows-native autopilot until fixed.
5. Defense-in-depth gates (`blockedAt` in portal-gate) still matter even when JWT callback already clears blocked users — tests caught the 403/401 distinction.
