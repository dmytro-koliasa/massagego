# Restore project agent skills

Idempotent, **manually triggered**. Not connected to app build, runtime, CI, or deploy.

## Pinned tooling

- Skills CLI: **`skills@1.9.0`** (verify with `npx skills@1.9.0 --version`)
- Canonical sources: `agent-skills/`
- Lockfile: repo-root `skills-lock.json`
- Discovery targets (gitignored): `.agents/skills/`, `.cursor/skills/`, `.claude/skills/`

## What restore does

1. Ensures discovery directories exist.
2. Junctions or copies **canonical** skills from `agent-skills/` into all three discovery roots:
   - `next-bundle-optimizer-hardened`
   - `seo-audit-hardened`
   - `massagego-i18n-best-practices`
3. Optionally re-links other **approved** lockfile skills that already exist under `.agents/skills/` into `.cursor/skills` and `.claude/skills` (content-preserving; no upstream re-download by default).
4. **Never** installs or restores `next-bundle-optimizer` or `seo-audit` (unsafe originals).
5. **Never** overwrites hardened/custom skills with upstream copies.

## What restore does not do

- Does not run `skills add` for disabled names  
- Does not modify `src/`, Next config, or dependencies  
- Does not require elevated privileges  
- Does not use paid services  

## Commands

Windows (PowerShell), from repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\agent-skills\scripts\restore-skills.ps1
powershell -ExecutionPolicy Bypass -File .\agent-skills\scripts\verify-skills.ps1
```

WSL / Unix:

```bash
bash ./agent-skills/scripts/restore-skills.sh
bash ./agent-skills/scripts/verify-skills.sh
```

Dry-run:

```powershell
.\agent-skills\scripts\restore-skills.ps1 -DryRun
```

## Third-party refresh (separate approval)

Updating pins requires Security Review, then:

```bash
npx skills@1.9.0 add <repository> --skill <skill-name> -a cursor claude-code -y
```

Re-run restore afterward so `.cursor` / `.claude` stay aligned. Do **not** add disabled skills.

## Isolated test

```powershell
.\agent-skills\scripts\restore-skills.ps1 -TestDir "$env:TEMP\massagego-skills-restore-test"
```

Creates a temp discovery layout and verifies hardened skills appear and disabled names do not.
