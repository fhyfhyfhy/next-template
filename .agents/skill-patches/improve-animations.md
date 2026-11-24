# improve-animations

Upstream: `skills/improve-animations/` in `emilkowalski/skills`, as `npx skills update` installs it.

## No canned first reply

An agent that invokes the skill mid-task needs the audit, not a greeting that waits for a question.

```diff
@@ ## Initial Response @@
 # Improving Animations
 
-## Initial Response
-
-When this skill is first invoked without a specific question, respond only with:
-
-> I'm ready to audit your animations and plan the fixes, my knowledge comes from Emil Kowalski's animation philosophy.
-
-Do not provide any other information until the user asks a question.
-
 An advisor skill modeled on the audit-then-plan workflow: use the capable model for the part where judgment compounds — understanding the codebase's motion, deciding what's worth fixing, writing the spec — and hand execution to any agent, including cheaper models.
```

## This repo's motion conventions

This repo keeps its motion conventions in `.claude/rules/components.md` and its library picks in `.claude/rules/libraries.md`, so the skill's gentler-not-zero reduced motion, its hover media queries, and its plain CSS don't apply here as written, and AUDIT.md would report the global reduced-motion rule itself. The skill's sweeps grep only CSS syntax, which misses motion written as classes.

```diff
@@ before ## Operating Posture @@
 
+Motion follows `.claude/rules/components.md`, Styles and variants, and components come from the libraries in `.claude/rules/libraries.md`; both hold wherever this skill, AUDIT.md, or PLAN-TEMPLATE.md says otherwise, including their reduced-motion handling, hover media queries, curve definitions, and hand-built drawers and toasts. A missing reduced-motion variant or hover media query on CSS motion is not a finding, and neither is the global reduced-motion rule in `app/globals.css`; a plan's reduced-motion check confirms that the motion completes at once. Sweep the class forms as well, such as `transition-`, `ease-`, `duration-`, `animate-`, `origin-`, `scale-`, `starting:`, `data-starting-style:`, and `data-ending-style:`.
+
 ## Operating Posture
```

## Plans are committed under `docs/`

The skill writes its plans to a root `plans/` that it never commits, so `git worktree remove` refuses the worktree holding them, and the worktree that `execute <plan>` starts from main has none of them. This repo keeps its documents in `docs/`, so the plans go to `docs/animation-plans/` and reach main in a PR of their own, the one commit Hard Rule 2 allows.

```diff
@@ ## Hard Rules @@
 ## Hard Rules
 
-1. **Never modify source code.** The only files you create or edit live under `plans/` (or `animation-plans/` if `plans/` already exists for something else). If asked to "just fix it", decline and point to `improve-animations execute <plan>` or to running the plan with any agent.
-2. **No mutating operations.** No installs, no builds with side effects, no commits, no formatters. Read-only analysis only.
+1. **Never modify source code.** The only files you create or edit live under `docs/animation-plans/`. If asked to "just fix it", decline and point to `improve-animations execute <plan>` or to running the plan with any agent.
+2. **No mutating operations.** No installs, no builds with side effects, no formatters, and no commits other than the plans' own PR (Phase 4). Read-only analysis only.
 3. **Plans must be fully self-contained.** The executor has zero context from this conversation and zero taste. Never write "use the easing discussed above" — inline the exact cubic-bezier, the exact duration, the exact file path and code excerpt.
```

```diff
@@ end of ### Phase 4 — Write plans @@
 Finish by creating or updating `plans/README.md`: recommended execution order, dependencies between plans, and a status column.
+
+Commit the plans and their README in a PR of their own, and the changes a `reconcile` makes the same way: an executor's worktree starts from main, so `execute <plan>` takes a plan that has reached main. The PR that carries out a plan marks it DONE in the README.
 
 ## Invocation Variants
```

| Upstream | Workspace |
| --- | --- |
| `plans/` | `docs/animation-plans/` |

Scope: `SKILL.md` and `PLAN-TEMPLATE.md`, as in `plans/README.md`, which becomes `docs/animation-plans/README.md`.

## Plans are written in the prose language

Plans are documents that people review, so they take the prose language `.claude/rules/writing-style.md` sets for plans; the skill and PLAN-TEMPLATE.md are in English, which would otherwise pull them into English.

```diff
@@ end of ### Phase 4 — Write plans @@
 Finish by creating or updating `plans/README.md`: recommended execution order, dependencies between plans, and a status column.
+
+Write the plans and their README in the prose language that `.claude/rules/writing-style.md` sets for plans, translating PLAN-TEMPLATE.md's headings too, and keep code, paths, class names, and other terms as they are.
```
