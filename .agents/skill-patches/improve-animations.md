# improve-animations

Upstream: `skills/improve-animations/` in `emilkowalski/skills`, as `npx skills update` installs it.

## Plans in the prose language

`.claude/rules/writing-style.md` sets the prose language for the body of plans, and the plans this skill writes stay in the repo for the team to read.

```diff
@@ ### Phase 4 — Write plans @@
 One plan per selected finding, using [PLAN-TEMPLATE.md](PLAN-TEMPLATE.md), written into `plans/` as `NNN-short-slug.md` (monotonic numbering; respect existing plans). Stamp each plan with the current commit (`git rev-parse --short HEAD`).
 
+Write each plan and `plans/README.md` in the prose language that `.claude/rules/writing-style.md` sets; PLAN-TEMPLATE.md's headings and labels are already in it. Status (`TODO`, `DONE`), severity (`HIGH`, `MEDIUM`, `LOW`), and category names stay as this skill and AUDIT.md spell them, so plans, the README table, and `reconcile` share one vocabulary.
+
 Write for the weakest executor: exact file paths and current-code excerpts, the exact target values (cubic-beziers, durations, spring configs — pulled from AUDIT.md, never approximated), the repo's own conventions with an exemplar, ordered steps, hard scope boundaries, and a verification section including how to *feel-check* the result (slow motion, frame-by-frame, real device for gestures).
```

## Template headings in the prose language

Every plan copies the skeleton's headings and labels verbatim, so fixing their wording here keeps them identical across plans and runs. The Workspace column is in Simplified Chinese, the current prose language; translate it when `.claude/rules/writing-style.md` changes the prose language.

File: PLAN-TEMPLATE.md

| Upstream | Workspace |
| --- | --- |
| `**Status**` | `**状态**` |
| `**Severity**` | `**严重程度**` |
| `**Category**` | `**类别**` |
| `**Estimated scope**` | `**预估范围**` |
| `## Problem` | `## 问题` |
| `## Target` | `## 目标` |
| `## Repo conventions to follow` | `## 要遵循的仓库约定` |
| `## Steps` | `## 步骤` |
| `## Boundaries` | `## 边界` |
| `## Verification` | `## 验证` |
| `**Mechanical**` | `**自动检查**` |
| `**Feel check**` | `**手感检查**` |
| `**Done when**` | `**完成标准**` |

Scope: the plan skeleton in the fenced `markdown` block. Stays: `**Commit**`, the `<…>` placeholders, the code excerpts, and the notes after the block, such as "The feel check is not optional".
