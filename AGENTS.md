## 规则文件

`.claude/rules/`（含子目录）里每个 `.md` 是一条规则。会话里开始第一个任务前，读完这些文件并照做：frontmatter 带 `paths` 的，只管匹配这些 glob 的文件（相对项目根目录，即本文件所在目录）；不带的，管所有任务。Claude Code 会自己按 frontmatter 加载它们，跳过这一步。

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
