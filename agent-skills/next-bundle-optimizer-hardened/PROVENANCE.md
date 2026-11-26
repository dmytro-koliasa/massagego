# Provenance: next-bundle-optimizer-hardened

## Upstream

| Field | Value |
| --- | --- |
| Source | `vercel/next.js` |
| Skill path | `skills/next-bundle-optimizer/` |
| Ref | `canary` |
| Commit | `26b5790940b7187f5525763b3a0a10985d8fc4be` |
| Upstream skill name | `next-bundle-optimizer` |
| Lockfile hash (skills-lock computedHash) | `2a2d38e9ba5476f6eef7a86cc1531801b454fdcd5ee8b96745973e01b5d25397` |
| Local quarantined SKILL.md SHA-256 | `A0CBA357640FDBA9077E529547A512062DB50665E456485BC234BF096589EDDA` |
| License | MIT (Next.js repository license) |

## Security findings (pre-hardening)

| Severity | Finding | Status after hardening |
| --- | --- | --- |
| Critical / High | Instructs agents to run `next analyze` **outside the sandbox** when TCP bind is blocked | **Mitigated:** sandbox-bypass language removed; failures must be reported |
| High | Auto-installs sibling skills via `npx skills add` (cache-components, partial-prefetching, next-dev-loop) | **Mitigated:** auto-install forbidden; suggestions only with approval |
| Medium | Redirects into Cache Components / experimental optimizer skills | **Mitigated:** Cache Components enablement and those installs forbidden |
| Medium | Fix mode can apply edits after audit tooling runs | **Mitigated:** audit-only default; fix requires explicit named approval |
| Low | Relies on `/tmp` and Bash-only examples | **Mitigated:** Windows/WSL examples; no privilege escalation |

Scanner note: No separate free malware scanner was run against Markdown skill text beyond manual review and pattern search. Repository reputation alone does not dismiss findings. Markdown instructions do not enforce security by themselves; agents may still mis-follow them — operators must keep discovery paths free of the unsafe original.

## Local modifications

1. Renamed skill to `next-bundle-optimizer-hardened`.
2. Removed sandbox-bypass instructions.
3. Removed automatic `npx skills add` / sibling skill installation.
4. Removed Cache Components / experimental feature enablement paths.
5. Default audit-only; explicit approval required for application fixes.
6. Restricted tooling to installed project-local Next.js CLI.
7. Added Windows PowerShell capture examples.
8. Added mandatory hardening rules and provenance.

## Disabled original

Upstream `next-bundle-optimizer` must not be restored into `.agents/skills/`, `.cursor/skills/`, or `.claude/skills/`. Quarantine copy (outside discovery): `.skills-quarantine/next-bundle-optimizer/` (gitignored). See `agent-skills/_meta/DISABLED-SKILLS.md`.
