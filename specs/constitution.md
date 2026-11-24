# Constitution

## Core Principles

1. **Correctness + account safety over speed**
   - Prefer fail-closed / refuse over “almost right”.
   - Blocked/deleted users must not keep useful access via shared gates, proxy, or JWT leftovers.
   - Booking integrity and auth isolation beat ship velocity and polish.
   - Cost accepted: stricter UX edges, more tests, slower feature churn when safety conflicts.

2. **Portal isolation is sacred**
   - Client, masseur, and admin are separate Auth.js instances, cookies, and DB portal roles.
   - Do not “simplify” by merging sessions or trusting a cookie from another portal.
   - Dual-session APIs require an explicit portal hint (`X-Portal`) or fail closed (`ambiguous_portal`).

## Constraints

1. **Stack lock**
   - Binding stack: Next.js 16 App Router, Auth.js (`next-auth` v5 beta), Prisma 6 + PostgreSQL, Zod 4, React 19, Vitest + Playwright, Tailwind 4, Resend / Telegram / Vercel Blob as used today.
   - Major upgrades (Next major, Prisma 7, leaving next-auth beta, etc.) need a separate owner decision / issue — not drive-by in feature work.
   - Patch/minor bumps OK when CI stays green and changelog is reviewed.

2. **No production enablement without owner yes**
   - Cards must not: production deploy, paid host/plan signup, live custom email domain, public Telegram webhook registration, production DB migrate, or turn on paid cron that incurs cost — without explicit owner approval in-session.
   - Prefer leaving P0 host/legal/email/cron work deferred until an explicit go.

3. **Secrets and PII stay out of logs and artifacts**
   - Never put `AUTH_SECRET`, `CRON_SECRET`, passwords, raw reset/verify tokens, or full phone/email into code, logs, tickets, or screenshots.
   - Tests use fixtures only — not production data.
   - Prefer redacted / hashed identifiers (as with rate-limit keys).

4. **Git is in use**
   - Worktrees, branches, conventional commits, and one-card-per-session protocol are allowed.

## Quality Standards

1. **Testing bar**
   - CI must stay green: lint, knip, typecheck, build, unit + integration.
   - Every security/behavior change ships with unit and/or integration tests that fail if the new check is removed.
   - E2E required when the change is primarily a user-visible flow; not mandatory for pure server-gate fixes.
   - Prefer tests against `massage_test`, never against the dev `massage` DB.

2. **UX & accessibility**
   - Preserve existing a11y patterns (labeled fields, ModalDialog focus trap / Escape).
   - Aim for WCAG 2.2 AA on screens a card touches — not a full-site audit every PR.
   - Interface cards verified with screenshots at ~390px and ~1280px; pure server/security cards need no screenshots.
   - Reuse existing design tokens / sage palette / components unless a card explicitly redesigns.

## Governance

1. **Owner-only amendments**
   - Only the owner may approve changes to this constitution.
   - Agents must not silently edit it. If a feature conflicts with a principle or constraint, stop and ask whether to amend before continuing.
   - Triggers for review: before public production release; when a stack-lock or core-principle decision is overturned; when the owner invokes an amend.

## Open Questions

(none)

Approved: 2026-11-24
