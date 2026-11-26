#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TEST_DIR="${TEST_DIR:-}"
FAILED=0
DISABLED=("next-bundle-optimizer" "seo-audit")
CANONICAL=("next-bundle-optimizer-hardened" "seo-audit-hardened" "massagego-i18n-best-practices")

pass() { echo "PASS  $*"; }
fail() { echo "FAIL  $*"; FAILED=$((FAILED + 1)); }

if [[ -n "$TEST_DIR" ]]; then
  ROOTS=("$TEST_DIR/agents-skills" "$TEST_DIR/cursor-skills" "$TEST_DIR/claude-skills")
else
  ROOTS=("$ROOT/.agents/skills" "$ROOT/.cursor/skills" "$ROOT/.claude/skills")
fi

for name in "${CANONICAL[@]}"; do
  [[ -f "$ROOT/agent-skills/$name/SKILL.md" ]] && pass "canonical $name" || fail "canonical $name"
done

for r in "${ROOTS[@]}"; do
  for name in "${CANONICAL[@]}"; do
    [[ -f "$r/$name/SKILL.md" ]] && pass "discoverable $r/$name" || fail "missing $r/$name"
  done
  for name in "${DISABLED[@]}"; do
    [[ -e "$r/$name" ]] && fail "disabled present $r/$name" || pass "disabled absent $name in $r"
  done
done

if [[ -f "$ROOT/skills-lock.json" ]]; then
  if grep -q '"skillsCliVersion"[[:space:]]*:[[:space:]]*"1.9.0"' "$ROOT/skills-lock.json"; then
    pass "skills CLI pin 1.9.0"
  else
    fail "skills CLI pin missing"
  fi
else
  fail "skills-lock.json missing"
fi

[[ "$FAILED" -eq 0 ]] || { echo "$FAILED failed"; exit 1; }
echo "All checks passed."
