---
name: skills-and-rules
description: This repo's skills and rules. Use when adding, updating, customizing, or creating a skill, or adding or editing a rule.
---

Run these commands from the repo root.

## Skills

Skills live in `.agents/skills/<name>/`, the agent-neutral location that Codex and other agents read. Claude Code reads only `.claude/skills/`, which holds local, git-ignored links to them. `scripts/link-skills.sh` makes those links, and Claude Code runs it at every session start.

- Add a third-party skill: `npx skills add <owner/repo> -s <skill> -a claude-code -a codex -y`. It records the source in `skills-lock.json`.
- Update third-party skills: `npx skills update -p -y`. Apply the patch of every changed skill that has one, and tell the user what upstream changed in the rest.
- Customize a third-party skill: add the change to its patch, `.agents/skill-patches/<skill>.md`.
- Create your own skill: write `.agents/skills/<name>/SKILL.md`.

Read [PATCHES.md](PATCHES.md) before writing or applying a patch.

A skill change is done when `.agents/skills/<name>/SKILL.md` is in place and, in Claude Code, `.claude/skills/<name>/SKILL.md` resolves; mid-session, run `bash scripts/link-skills.sh` to get there.

## Rules

- A short rule for every task goes in `AGENTS.md`, which `CLAUDE.md` imports.
- A longer topic, or a rule for only some files, goes in its own `.claude/rules/<topic>.md`. It needs no pointer: Claude Code loads these files itself, and `AGENTS.md` § Rule files sends Codex and Cursor there.
- Leave to the linter whatever it can check; a rule holds the judgment calls lint can't express.

## Citing code

In skills and rules, cite this repo's code as `symbol` in `path`, the path written from the repo root, such as `fetchApi` in `lib/fetch.ts`, so the reader opens it without searching; cite a whole file by its path alone. Later mentions in the same document use the name alone. Symbols from frameworks and packages take no path.

Cite only code that a project made from this template keeps: the layers outside `features/`, `features/ui-catalog/` (the catalog of `components/ui/` at `/ui`), the app shell in `app/` (root layout, providers, not-found page), scripts, config, and the e2e helpers in `e2e/test.ts`, `e2e/browser.ts`, and `e2e/backend.ts`. The other features, their routes and API, their messages, and their specs are this repo's sample product, which a project replaces with its own; skills and rules reach them only through rules that hold for any feature. Show a pattern taken from them as a short inline snippet with generic names, such as an `orders` feature, so the skill or rule still reads correctly once the sample product is gone.
