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

The sample product, which "Starting a project" in `README.md` lists, is the working reference for the conventions: cite its code wherever a skill or rule needs a working example. A project made from this template deletes it, so cite it as a link to this repo on GitHub, with the repo-root path as the link text: `symbol` in [`features/task/server/tasks.ts`](https://github.com/fhyfhyfhy/next-template/blob/main/features/task/server/tasks.ts). Percent-encode `[`, `]`, `(`, and `)` in the URL, and use `tree` in place of `blob` for a directory. The path still opens locally in this repo, and the link still opens once a project has deleted the sample product. Cite code a project keeps by its plain path. A pattern shown in a few lines may use a snippet with generic names, such as an `orders` feature; link the sample product's working version beside it when it has one. `scripts/docs-links.test.mjs` checks that each link's file exists and that agent docs write no sample-product path without a link.
