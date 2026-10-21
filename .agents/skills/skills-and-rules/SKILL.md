---
name: skills-and-rules
description: This repo's skills and rules. Use when adding, updating, customizing, or creating a skill, or adding a rule.
---

Run these commands from the repo root.

## Skills

Skills live in `.agents/skills/<name>/`, the agent-neutral location that Codex and other agents read. Claude Code reads only `.claude/skills/`, which holds local, git-ignored links to them. `scripts/link-skills.sh` makes those links, and Claude Code runs it at every session start.

- Add a third-party skill: `npx skills add <owner/repo> -s <skill> -a claude-code -a codex -y`. It records the source in `skills-lock.json`.
- Update third-party skills: `npx skills update -p -y`. Apply the patch of every changed skill that has one, and tell the user what upstream changed in the rest.
- Customize a third-party skill: add the change to its patch, `.agents/skill-patches/<skill>.md`.
- Create your own skill: write `.agents/skills/<name>/SKILL.md`.

Read [PATCHES.md](PATCHES.md) before writing or applying a patch.

A skill change is done when `.claude/skills/<name>/SKILL.md` resolves; mid-session, run `scripts/link-skills.sh` to get there.

## Rules

- A short rule for every task goes in `AGENTS.md`, which `CLAUDE.md` imports.
- A longer topic, or a rule for only some files, goes in its own `.claude/rules/<topic>.md`. It needs no pointer: Claude Code loads these files itself, and `AGENTS.md` § 规则文件 sends Codex and Cursor there.
- Leave to the linter whatever it can check; a rule holds the judgment calls lint can't express.
