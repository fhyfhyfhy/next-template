## Rule files

> **Claude Code: skip this section.** Claude Code loads these rules automatically based on their frontmatter.

Every `.md` file in `.claude/rules/` (including subdirectories) is a rule. Before starting the first task in a session, read all rule files and follow them:

- A rule whose frontmatter has `paths` applies only to files matching those globs (relative to the project root, the directory containing this file).
- A rule without `paths` applies to every task.

## Knowledge

Knowledge about this repo that later sessions need goes into the repo, placed per the `skills-and-rules` skill.

## Test and lint tooling

- When adding tests, reuse the existing test entry and select scope through runner arguments. Add a separate entry only when execution setup differs, such as browser tests requiring a server.
- When adding source checks, extend the existing linter through configuration, plugins, or local rules. Use a standalone checker only when the linter cannot support the required inputs or execution, and document that limitation.

## Cross-platform and cross-tool

This repo is worked on from macOS and Windows, with Claude Code, Codex, and other agents that read `AGENTS.md` (such as Cursor). When adding a rule, skill, script, or command, make it work for every combination:

- Each tool enters through a different file. Claude Code reads `CLAUDE.md`, which imports `AGENTS.md`, and loads `.claude/rules/` itself; Codex and Cursor read `AGENTS.md`, whose § Rule files sends them to `.claude/rules/`. Behavior that lives only in one tool's config, such as a hook in `.claude/settings.json`, reaches that tool alone: confirm the other tools get it another way, as Codex reads `.agents/skills/` directly while Claude Code relies on the links its SessionStart hook makes.
- Reference other files in rules, skills, and `AGENTS.md` by plain path or Markdown link. Only Claude Code expands `@path`, and the expanded file then stays in context all session; `CLAUDE.md`'s `@AGENTS.md` is the one intended import.
- Write project tooling as Node: an `.mjs` under `scripts/`, started from a `package.json` script. pnpm runs those script bodies in cmd.exe on Windows, so keep each body to commands joined by `&&` and put any other logic in the `.mjs`. Bash stays for glue that Claude Code itself runs, such as `scripts/link-skills.sh`.
- Write commands in bash syntax: the macOS shell and the Git Bash that Claude Code uses on Windows both accept it. Codex on Windows runs PowerShell, where heredocs, `VAR=x cmd`, and `(cd … && …)` are written differently; when a command uses one of these, give the PowerShell form alongside it.
- Write paths relative to the repo root. Where the two systems genuinely differ, branch on the OS as `scripts/link-skills.sh` does for its links (a junction on Windows, a symlink on macOS). In Node, `symlinkSync(target, path, "junction")` links a directory on both without branching, as `eslint.config.test.mjs` does.
- Write text files in UTF-8 with LF line endings. `.gitattributes` checks out every text file with LF, overriding Git for Windows' CRLF default. Files created on Windows can still hold CRLF before they are committed, so Node code that hashes or compares file text normalizes `\r\n` first, as `scripts/ui-catalog/index-generator.mjs` does. Many tools on Chinese Windows default to GBK (Windows PowerShell, Python), and this repo holds Chinese text, such as `messages/zh/`: edit files with the editing tool, or pass UTF-8 explicitly, as the Node scripts here pass `"utf8"`.

## Environment variables

A value read while prerendering is frozen into the static output. `lib/env.ts` fails the build when a required variable is missing there, but two cases pass silently:

- The build environment also sets the variable, with a different value than at runtime.
- The variable is optional or has a default, and the build environment lacks it.

Read a value that must come from the runtime after `await connection()`.

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues, worked through the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five triage roles use their default label names. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Code review

Project reviews that the `code-review` skill runs beside its Standards and Spec axes. See `docs/agents/code-review.md`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
