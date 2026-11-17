# review-animations

Upstream: `skills/review-animations/` in `emilkowalski/skills`, as `npx skills update` installs it.

## Agents can reach the review

The descriptions of animate, find-animation-opportunities, animation-performance, and break-ui, and the `execute` variant of improve-animations, send agents here, yet `disable-model-invocation` lets only a user invoke the skill. The description now names when to use it, with no `: ` in it, which strict YAML parsers such as `npx skills` reject in a plain value.

```diff
@@ frontmatter @@
 name: review-animations
-description: Reviews animation and motion code against a high craft bar derived from Emil Kowalski's design engineering philosophy. Default to flagging; approval is earned.
-disable-model-invocation: true
+description: Reviews animation and motion code against a high craft bar derived from Emil Kowalski's design engineering philosophy. Use when asked to review or critique an animation, a transition, or the motion in a diff; for a whole codebase use improve-animations. Default to flagging; approval is earned.
 ---
```

## No canned first reply

An agent that invokes the skill mid-task needs the review, not a greeting that waits for a question.

```diff
@@ ## Initial Response @@
 # Reviewing Animations
 
-## Initial Response
-
-When this skill is first invoked without a specific question, respond only with:
-
-> I'm ready to review your animations against a high craft bar, my standards come from Emil Kowalski's animation philosophy.
-
-Do not provide any other information until the user asks a question.
-
 A specialized review skill. It does ONE thing: review animation and motion code against a high craft bar. It does not write features, fix unrelated bugs, or review non-motion code. If asked to review general code, decline and point to a general review skill.
```

## This repo's motion conventions

The animate skill's patch records this repo's motion conventions, and `.claude/rules/components.md` settles reduced motion, so the skill's gentler-not-zero reduced motion, its hover media queries, and its plain CSS don't apply here as written.

```diff
@@ before ## Operating Posture @@
 
+This repo's motion conventions are in "In this repo" of the animate skill (`.agents/skills/animate/SKILL.md`), and they hold wherever this skill or STANDARDS.md says otherwise: motion is Tailwind classes, `hover:` is gated already, the `ease-out` and `ease-in-out` classes are the strong curves, and drawers, toasts, and drag to dismiss come from Base UI and Sonner. Reduced motion is global: `app/globals.css` ends every CSS transition and animation under `prefers-reduced-motion` (`.claude/rules/components.md`, Styles and variants), so CSS motion needs no reduced-motion variant of its own, and motion run from JavaScript checks `useReducedMotion` from `@mantine/hooks`. A missing reduced-motion variant or hover media query on CSS motion is not a finding.
+
 ## Operating Posture
```
