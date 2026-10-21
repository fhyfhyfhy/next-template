#!/usr/bin/env bash
# Claude Code 只读 .claude/skills，所以把 .agents/skills 里的每个 skill 链接过去。
# 这些链接只在本地，已被 .gitignore 忽略。
set -euo pipefail
cd "$(dirname "$0")/.."

# Windows 上在 Git Bash 里运行；其他情况都是 macOS。
case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) windows=1 ;; *) windows= ;; esac

mkdir -p .claude/skills

# 删掉不再指向 skill 的链接：skill 被删了，或 checkout 挪了位置。
# Git Bash 把 junction 当作 symlink，所以 rm -f 只删链接本身。
for link in .claude/skills/*; do
  if [[ -L "$link" && ! -e "$link/SKILL.md" ]]; then
    rm -f "$link"
  fi
done

# 已有的条目可能是 `npx skills add -a claude-code` 建的链接，保留不动。
for dir in .agents/skills/*/; do
  name="$(basename "$dir")"
  [[ -e ".claude/skills/$name" || -L ".claude/skills/$name" ]] && continue
  if [[ -n "$windows" ]]; then
    # junction 不需要开发者模式，symlink 需要。
    MSYS_NO_PATHCONV=1 cmd /c mklink /J \
      "$(cygpath -w "$PWD/.claude/skills/$name")" "$(cygpath -w "$PWD/.agents/skills/$name")" >/dev/null
  else
    ln -s "../../.agents/skills/$name" ".claude/skills/$name"
  fi
done
