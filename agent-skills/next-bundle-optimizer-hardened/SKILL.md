---
name: next-bundle-optimizer-hardened
description: >
  Audit-only Next.js browser initial-load analysis for MassageGo. Use for slow
  route startup, oversized client bundles, duplicate browser dependencies, or
  features that can wait for interaction. Prefer this skill over the upstream
  next-bundle-optimizer. Default is audit-only; application fixes require
  explicit user approval. Does not install skills, enable Cache Components, or
  bypass sandboxes.
license: MIT (adaptation of upstream Next.js skill; see PROVENANCE.md)
metadata:
  author: massagego
  version: "1.0.0"
  upstream: vercel/next.js
  upstreamSkill: next-bundle-optimizer
  upstreamCommit: "26b5790940b7187f5525763b3a0a10985d8fc4be"
  hardening: audit-only-default no-auto-install no-sandbox-bypass no-cache-components
---

# Bundle optimizer (hardened)

Project-local adaptation of Vercel `next-bundle-optimizer` for MassageGo.

## Hardening rules (mandatory)

1. **Audit-only by default.** Generate analyzer artifacts and report candidates. Do not change application source, dependencies, lockfiles, or Next.js config unless the user explicitly requests fix mode for a named change.
2. **No sandbox bypass.** Never instruct elevating privileges, disabling sandbox/OS controls, or running captures “outside the sandbox.” If capture fails under current permissions, report the blocker and stop.
3. **No automatic skill installs.** Do not run `npx skills add`, install sibling skills (`next-cache-components-optimizer`, `next-partial-prefetching-optimizer`, `next-dev-loop`, etc.), or modify agent skill trees. Suggest names only as optional follow-ups requiring separate approval and Security Review.
4. **No Cache Components / experimental enablement.** Do not enable Cache Components, PPR experiments, or unrelated Next.js flags. Do not redirect work into cache-components optimizers.
5. **No unreviewed external scripts.** Use only the project’s installed Next.js CLI (`next analyze` / `next analyze export`) via the project package manager. Do not download or execute third-party analyzer scripts.
6. **Explicit approval for fixes.** Fix mode requires an explicit user request naming the intended edit. Ask before changing visible behavior, timing, compatibility, or a trust boundary.

If the unsafe upstream skill `next-bundle-optimizer` is present in a discovery path, **ignore it** and use this hardened skill only.

## 1. Set the scope

Analyze the whole app by default. Narrow only when the user specifies a route, dependency, feature, or subset. Record scope, mode (`audit` default / `fix` only if explicitly requested), and intended behavior.

**Done:** scope, mode, and intended behavior are recorded. A request to capture or export data is audit mode, not permission to fix.

## 2. Capture and export a baseline

Run from the app directory with its package manager. Read `next analyze --help` and `next analyze export --help` for the **installed** Next.js CLI.

Reuse a saved snapshot, or capture with a distinctive name; export through gzip. Keep before/after `.jsonl.gz` files separate.

Prefer project-local or OS temp paths the agent already may write to. On Windows PowerShell:

```powershell
# Capture only when a new baseline is needed (npm/pnpm/yarn as used by the repo)
npx next analyze --output --snapshot 'audit-before-unique-1'
npx next analyze export --snapshot 'audit-before-unique-1' | gzip > "$env:TEMP\analyze-app-before.jsonl.gz"
```

Bash equivalent (WSL / Unix):

```bash
set -o pipefail
npx next analyze --output --snapshot 'audit-before-unique-1'
npx next analyze export --snapshot 'audit-before-unique-1' | gzip > /tmp/analyze-app-before.jsonl.gz
```

Omit `--route` for whole-app analysis; add it for a user-specified route. For a custom `distDir`, replay with `--dist-dir`. Use distinct before/after snapshot names.

If capture fails (permissions, missing CLI, build errors), record the exact error and stop. Do not escalate privileges.

**Done:** capture identified, export succeeded (or blocker recorded), baseline file and scope noted. Discard output when export or gzip fails.

## 3. Interpret the evidence

Resolve the schema from the app's **installed Next.js**:

```bash
node -p "require.resolve('next/analyze/graph-v1.schema.json')"
```

Stream decompression into a line-oriented analysis rather than loading the whole dump into context. Treat results as **build evidence**; browser timing claims need separate evidence.

**Done:** route-attributed client/server contributions and the metric are identified.

## 4. Explain a candidate

Inspect project source and importers. Rank client-output contributions by attributed size, repetition, likely runtime cost, need before interaction, and correctness risk.

### Optional graph pass

For broad audits, community detection → target selection → directed min-cut → source validation may help. Read [Graph methods](references/graph-methods.md) before constructing graphs or running solvers. If tooling blocks the pass, record the blocker.

### Graph-evidence checklist

Before proposing an edit, record for each candidate: **Scope**, **Coverage**, **Attribution**, **Reachability**, **Source checks**, **Method**. Mark inapplicable items with reasons.

For lazy features, duplicates, or server-rendered display work, read [Fix patterns](references/fix-patterns.md) before proposing an edit (proposal only in audit mode).

### Unexpected client dependencies

Before scanning, read [Client dependencies](references/client-dependencies.md). Produce a **Client-dependency scan** table: **Source + client importer**, **Emitted identity**, **Routes**, **Compressed bytes**, **Disposition + evidence**. Dispositions: **possible leak**, **suppressed**, **unverified**.

**Done:** every size candidate has checklist, source/importer, proposed edit, and behavior checks. Audit mode ends after the report.

## 5. Verify one change — fix mode only

Requires explicit user approval for the named change. Classify each edit as size optimization or boundary remediation. Make one small cohesive change. Capture an after snapshot and compare the same scope/metric. Run relevant tests and type-check using **existing project scripts** only.

Do not install additional skills to verify. If verification is blocked, report the unverified edit and blocker.

**Done:** retain only when scoped metric improves and intended behavior passes; otherwise revert and report.

## 6. Report and stop

Include snapshot names, scoped attribution/deltas, exact source/importer, behavior-check results, and blockers. Distinguish source facts, build evidence, heuristics, and runtime observations. Add **Possible server-only leaks**, **Suppressed matches**, and **Evidence gaps** as applicable.

**Done:** every scoped candidate and attempted edit is accounted for with evidence or a stated gap.

## Provenance

See [PROVENANCE.md](PROVENANCE.md) for upstream source, revision, hash, license, security findings, and local modifications.
