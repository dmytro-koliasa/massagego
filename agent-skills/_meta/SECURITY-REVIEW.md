# Security review — Agent Skills (MassageGo)

**Date:** 2026-11-26  
**Scope:** Project-local skills hardening (C+ decisions)  
**Tools:** Manual review, pattern search; free Skills CLI 1.9.0 pinned for restore semantics  
**Not run:** Paid malware scanners; Claude Code runtime discovery (static docs only)

## Threat model

External skills are untrusted until reviewed. Markdown cannot enforce security. Risks: prompt injection, sandbox bypass, unreviewed script execution, credential exposure, unexpected network, auto skill/tool install, paid dependencies, architecture conflicts, duplicate contradictory skills.

## Findings summary

### next-bundle-optimizer (upstream)

| ID | Severity | Confirmed? | Mitigation |
| --- | --- | --- | --- |
| NBO-1 | High | Confirmed in SKILL.md | Hardened skill removes sandbox-bypass |
| NBO-2 | High | Confirmed | No auto `npx skills add` |
| NBO-3 | Medium | Confirmed | No Cache Components enablement |
| NBO-4 | Medium | Confirmed | Audit-only default |

### seo-audit (upstream)

| ID | Severity | Confirmed? | Mitigation |
| --- | --- | --- | --- |
| SEO-1 | Medium | Confirmed (residual even with upstream note) | Hardened untrusted-input rules |
| SEO-2 | Medium | Confirmed | Block Firecrawl/Magister/paid as default path |
| SEO-3 | Medium | Confirmed | GSC read-only + approval gate |
| SEO-4 | Low | Confirmed | No secrets in reports |

### Residual risks (accepted)

1. Agents may ignore skill text and still escalate privileges — process/policy control required.
2. Other lockfile skills (OmniRoute, claude-mem, etc.) were **not** fully re-hardened in this change; classified separately; OmniRoute removal needs separate approval.
3. Discovery path copies can drift if restore is skipped after a bad `skills add`.
4. Prompt injection via web content remains possible whenever any skill fetches URLs — operators must keep hardened SEO skill active and originals disabled.

## Policy going forward

- **Security Review required** before updating any third-party skill pin in `skills-lock.json`.
- Prefer adapting into `*-hardened` over restoring originals.
- Free tools only for MassageGo agent workflows unless owner explicitly opts into paid.

## Repeat review (post-hardening)

Re-checked hardened SKILL.md files for: sandbox bypass, auto-install, Cache Components enablement, paid MCP defaults, credential exfil instructions. **None found** in hardened texts. Originals removed from planned discovery restore set.
