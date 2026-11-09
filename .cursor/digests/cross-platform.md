---
source: .claude/rules/cross-platform.md
source-sha256: 90138d347f80f3edd8a5c8559c7cdf1a23f3c148f457187c93b927de251d58bb
---

- Behavior in one tool's config alone, like a `.claude/settings.json` hook, also reaches other tools another way.
- Rules, skills and `AGENTS.md` cite files by path or link, not `@path` (only Claude Code expands it), except `CLAUDE.md`'s `@AGENTS.md`.
- Tooling is Node `.mjs` under `scripts/`; a `package.json` script body only chains commands with `&&` (cmd.exe on Windows). Bash is only for glue Claude Code itself runs.
- Commands are bash; a heredoc, `VAR=x cmd` or `(cd … && …)` also gets its PowerShell form.
- Paths are project-root-relative. Where macOS and Windows differ, branch on the OS as `scripts/link-skills.sh` does; Node links directories with `symlinkSync(…, "junction")`.
- Rule or skill commands writing files pass UTF-8, as Windows PowerShell and Python on Chinese Windows default to GBK. Node normalizes `\r\n` before hashing or comparing text.
