## Rule files

> **Claude Code: skip this section.** Claude Code loads these rules automatically based on their frontmatter.

Every `.md` file in `.claude/rules/` (including subdirectories) is a rule. Before starting the first task in a session, read all rule files and follow them:

- A rule whose frontmatter has `paths` applies only to files matching those globs (relative to the project root, the directory containing this file).
- A rule without `paths` applies to every task.

## Knowledge

Knowledge about this repo that later sessions need goes into the repo, placed per the `skills-and-rules` skill.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
