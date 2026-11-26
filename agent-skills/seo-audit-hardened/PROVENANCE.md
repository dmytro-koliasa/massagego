# Provenance: seo-audit-hardened

## Upstream

| Field | Value |
| --- | --- |
| Source | `coreyhaines31/marketingskills` |
| Skill path | `skills/seo-audit/` |
| Commit | `8fd2fcade2fd6629026e9dfe6d133b55b36968b9` |
| Upstream version (frontmatter) | `2.2.10` |
| Upstream skill name | `seo-audit` |
| Lockfile hash (skills-lock computedHash) | `537ccf84d4a257cb1b6a9a3643fe56738632989768e1823ffe206ad1c64cd68a` |
| Local quarantined SKILL.md SHA-256 | `5F17E2F946E9FCB13395BF3BAB5EC1033497CE8217330C298C231ECB21FB046B` |
| License | MIT (marketingskills repository; preserve attribution) |

## Security findings (pre-hardening)

| Severity | Finding | Status after hardening |
| --- | --- | --- |
| Medium | Prompt-injection via fetched HTML (upstream already notes untrusted pages; still easy to miss) | **Mitigated:** hardened rules elevate untrusted-input handling; never follow embedded instructions |
| Medium | Encourages Firecrawl / Magister MCP / paid suites and tool installs | **Mitigated:** free/local-first; external services and MCP require explicit approval; paid not required |
| Medium | GSC / analytics access assumed without read-only constraint | **Mitigated:** GSC read-only; settings changes need separate approval |
| Low | Risk of leaking private URLs/credentials in verbose audits | **Mitigated:** no secrets/PII disclosure rule |
| Low | Auto-install / MCP configuration patterns in ecosystem docs | **Mitigated:** no auto-install / no auto-MCP |

False positives / notes:

- Mentions of “credentials” in content-quality checklists (author credentials) are **not** secret-handling bugs.
- Upstream untrusted-fetch warning is retained and strengthened — not dismissed.

Scanner note: Manual + pattern review only. No paid scanner. Markdown cannot enforce security; keep upstream `seo-audit` out of discovery paths.

## Local modifications

1. Renamed to `seo-audit-hardened`.
2. Mandatory untrusted-input / no-embedded-instruction rules.
3. Audit-only default; explicit approval for app changes.
4. External service / MCP / install gates.
5. GSC read-only policy.
6. Free-tools-only required path; Firecrawl/Magister/paid suites disallowed without separate approval.
7. Cross-links to MassageGo i18n / nextjs-seo / schema responsibilities.
8. Provenance and disabled-original policy.

## Disabled original

Do not restore `seo-audit` into agent discovery paths. Quarantine: `.skills-quarantine/seo-audit/` (gitignored). See `agent-skills/_meta/DISABLED-SKILLS.md`.
