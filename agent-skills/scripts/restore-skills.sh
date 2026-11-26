#!/usr/bin/env bash
# Idempotent restore for WSL/Unix. Manual only. Never restores disabled originals.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DRYRUN="${DRYRUN:-0}"
TEST_DIR="${TEST_DIR:-}"
DISABLED=("next-bundle-optimizer" "seo-audit")
CANONICAL=("next-bundle-optimizer-hardened" "seo-audit-hardened" "massagego-i18n-best-practices")

info() { echo "[restore] $*"; }

link_or_copy() {
  local src="$1" dest="$2"
  if [[ "$DRYRUN" == "1" ]]; then
    info "DRYRUN $src -> $dest"
    return
  fi
  mkdir -p "$(dirname "$dest")"
  rm -rf "$dest"
  if ln -s "$src" "$dest" 2>/dev/null; then
    return
  fi
  cp -a "$src" "$dest"
}

if [[ -n "$TEST_DIR" ]]; then
  ROOTS=("$TEST_DIR/agents-skills" "$TEST_DIR/cursor-skills" "$TEST_DIR/claude-skills")
else
  ROOTS=("$ROOT/.agents/skills" "$ROOT/.cursor/skills" "$ROOT/.claude/skills")
fi

for r in "${ROOTS[@]}"; do
  mkdir -p "$r"
  for d in "${DISABLED[@]}"; do
    if [[ -e "$r/$d" ]]; then
      info "Removing disabled $r/$d"
      [[ "$DRYRUN" == "1" ]] || rm -rf "$r/$d"
    fi
  done
done

for name in "${CANONICAL[@]}"; do
  src="$ROOT/agent-skills/$name"
  [[ -f "$src/SKILL.md" ]] || { echo "Missing $src/SKILL.md"; exit 1; }
  for r in "${ROOTS[@]}"; do
    link_or_copy "$src" "$r/$name"
  done
done

if [[ -z "$TEST_DIR" && -d "$ROOT/.agents/skills" ]]; then
  for src in "$ROOT/.agents/skills"/*; do
    [[ -d "$src" ]] || continue
    name="$(basename "$src")"
    skip=0
    for d in "${DISABLED[@]}"; do [[ "$name" == "$d" ]] && skip=1; done
    for c in "${CANONICAL[@]}"; do [[ "$name" == "$c" ]] && skip=1; done
    [[ "$skip" == "1" ]] && continue
    link_or_copy "$src" "$ROOT/.cursor/skills/$name"
    link_or_copy "$src" "$ROOT/.claude/skills/$name"
  done
fi

info "Done. Run verify-skills.sh next."
