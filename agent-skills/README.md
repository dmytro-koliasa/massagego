# MassageGo agent skills (canonical)

Version-controlled, project-scoped AI tooling for **Cursor IDE**, **Cursor CLI**, and **Claude Code**.

## Layout

| Path | Role |
| --- | --- |
| `next-bundle-optimizer-hardened/` | Hardened bundle audit skill (canonical) |
| `seo-audit-hardened/` | Hardened SEO audit skill (canonical) |
| `massagego-i18n-best-practices/` | Project i18n skill (canonical) |
| `_meta/` | Security, disable list, OmniRoute proposal, restore docs |
| `scripts/` | Manual restore + verify (Windows + WSL) |

Discovery copies live under gitignored `.agents/skills/`, `.cursor/skills/`, `.claude/skills/` and are produced by restore.

## Quick start

```powershell
powershell -ExecutionPolicy Bypass -File .\agent-skills\scripts\restore-skills.ps1
powershell -ExecutionPolicy Bypass -File .\agent-skills\scripts\verify-skills.ps1
```

See `_meta/RESTORE.md`.

## Shared instructions

Vendor-neutral requirements live in repo-root `AGENTS.md`. `CLAUDE.md` includes `@AGENTS.md`. Cursor rules under `.cursor/rules/` stay thin adapters (local/gitignored or documented separately).
