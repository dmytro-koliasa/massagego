# Proposed OmniRoute / related skill removal list

**Status:** PROPOSAL ONLY — do **not** delete without separate explicit approval.

Classification is based on MassageGo (Next.js massage booking app) needing OmniRoute gateway tooling: generally **no** for application development. Skills remain installed until approved removal.

## Classification legend

- **REQUIRED** — needed for current MassageGo app delivery  
- **OPTIONAL** — useful sometimes, not core  
- **UNUSED** — no MassageGo workflow dependency observed  
- **UNKNOWN** — needs owner confirmation (external product)

## OmniRoute and cli-* skills

| Skill | Classification | Rationale |
| --- | --- | --- |
| cli-a2a | UNUSED | OmniRoute A2A JSON-RPC; not used by MassageGo app |
| cli-backup-sync | UNUSED | OmniRoute backup |
| cli-batches | UNUSED | Batch inference |
| cli-chat | UNUSED | OmniRoute chat completions |
| cli-compression | UNUSED | Prompt compression config |
| cli-contexts | UNUSED | Context engineering for OmniRoute |
| cli-cost-usage | UNUSED | OmniRoute cost |
| cli-eval | UNUSED | Eval suites |
| cli-health | UNUSED | Server health |
| cli-keys | UNUSED | API keys for OmniRoute |
| cli-mcp | UNUSED | OmniRoute MCP |
| cli-models | UNUSED | Model listing |
| cli-plugins-skills | UNUSED | Omni skills plugins |
| cli-policy-audit | UNUSED | Access policies |
| cli-providers | UNUSED | Provider connections |
| cli-resilience | UNUSED | Circuit breakers |
| cli-routing | UNUSED | Routing combos |
| cli-serve | UNUSED | Start/stop OmniRoute |
| cli-setup | UNUSED | OmniRoute setup |
| cli-skill-collector | UNUSED | Detect CLI tools for Omni |
| cli-tunnel | UNUSED | Tunnels |
| config-codex-cli | UNUSED | Codex CLI for OmniRoute |
| omni-agents-a2a | UNUSED | Same family |
| omni-api-keys | UNUSED | Same family |
| omni-auth | UNUSED | Same family |
| omni-budget | UNUSED | Same family |
| omni-cache | UNUSED | Same family |
| omni-cli-tools | UNUSED | Same family |
| omni-combos-routing | UNUSED | Same family |
| omni-compression | UNUSED | Same family |
| omni-context-rtk | UNUSED | Same family |
| omni-db-backups | UNUSED | Same family |
| omni-github-skills | OPTIONAL | Generic skill search; optional DevEx |
| omni-inference | UNUSED | Same family |
| omni-mcp | UNUSED | Same family |
| omni-models | UNUSED | Same family |
| omni-providers | UNUSED | Same family |
| omni-proxies | UNUSED | Same family |
| omni-resilience | UNUSED | Same family |
| omni-settings | UNUSED | Same family |
| omni-sync-cloud | UNUSED | Same family |
| omni-tunnels | UNUSED | Same family |
| omni-usage-logs | UNUSED | Same family |
| omni-version-manager | UNUSED | Same family |
| omni-webhooks | UNUSED | Same family |
| ponytail | UNKNOWN | Bundled with OmniRoute install; verify before removal |

## Exact proposed removal list (pending approval)

All rows classified **UNUSED** above, plus `ponytail` if confirmed unused. Keep `omni-github-skills` only if owner wants skill discovery via OmniRoute.

## Recoverable backup plan (when approved)

1. Copy listed skill dirs to `.skills-quarantine/omniroute-YYYYMMDD/`  
2. Remove from `.agents/skills`, `.cursor/skills`, `.claude/skills`  
3. Remove entries from `skills-lock.json`  
4. Commit lock + docs; do not delete quarantine until owner confirms  
