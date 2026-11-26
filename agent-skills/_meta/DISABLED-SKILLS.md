# Disabled skills (must not be restored)

These upstream skills are **quarantined** and must not appear under any project discovery path:

- `.agents/skills/`
- `.cursor/skills/`
- `.claude/skills/`
- `.codex/skills/`

| Disabled name | Reason | Replacement | Quarantine |
| --- | --- | --- | --- |
| `next-bundle-optimizer` | Sandbox-bypass instructions; auto skill install; Cache Components redirects | `next-bundle-optimizer-hardened` | `.skills-quarantine/next-bundle-optimizer/` |
| `seo-audit` | Paid/MCP/scrape tooling pressure; insufficient external-access gates | `seo-audit-hardened` | `.skills-quarantine/seo-audit/` |

## Restore script policy

`agent-skills/scripts/restore-skills.ps1` (and `.sh`) **refuse** to install or link these names from `skills-lock.json` or upstream registries. If present in lockfile historically, treat as `disabled: true` and skip.

## Manual re-enable

Re-enabling an unsafe original requires:

1. Fresh Security Review of the exact revision
2. Explicit owner approval
3. Update of this file and provenance docs
4. Prefer merging safe behavior into the `*-hardened` skill instead
