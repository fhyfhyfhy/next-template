#!/usr/bin/env bash
# Claude Code reads only .claude/skills, so this links each skill in .agents/skills there.
# The links are local only; .gitignore ignores them.
# The SessionStart hook in .claude/settings.json calls it with --hook.
set -euo pipefail
cd "$(dirname "$0")/.."

hook=
[[ "${1:-}" == --hook ]] && hook=1

# On Windows it runs in Git Bash; anywhere else is macOS.
case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) windows=1 ;; *) windows= ;; esac

mkdir -p .claude/skills

# Removes the links that no longer point to a skill: the skill was deleted, or the checkout moved.
# Git Bash treats a junction as a symlink, so rm -f removes only the link itself.
for link in .claude/skills/*; do
  if [[ -L "$link" && ! -e "$link/SKILL.md" ]]; then
    rm -f "$link"
  fi
done

# An existing entry may be a link made by `npx skills add -a claude-code`; it is left alone.
created=
for dir in .agents/skills/*/; do
  name="$(basename "$dir")"
  [[ -e ".claude/skills/$name" || -L ".claude/skills/$name" ]] && continue
  if [[ -n "$windows" ]]; then
    # A junction needs no Developer Mode; a symlink does.
    MSYS_NO_PATHCONV=1 cmd /c mklink /J \
      "$(cygpath -w "$PWD/.claude/skills/$name")" "$(cygpath -w "$PWD/.agents/skills/$name")" >/dev/null
  else
    ln -s "../../.agents/skills/$name" ".claude/skills/$name"
  fi
  created=1
done

# Claude Code scans the skill directories before the SessionStart hook finishes, so the links made
# this time take effect in the current session only if it prints reloadSkills.
# Otherwise it stays silent: a hook's plain-text output goes into Claude's context.
if [[ -n "$hook" && -n "$created" ]]; then
  printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"SessionStart","reloadSkills":true}}'
fi
