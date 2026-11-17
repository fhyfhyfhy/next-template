# emil-design-eng

Upstream: `skills/emil-design-eng/` in `emilkowalski/skills`, as `npx skills update` installs it.

## Agents know when to load it

The description names only topics, so an agent choosing skills on its own can't tell when this long skill is worth reading. It now names the moment, with no `: ` in it, which strict YAML parsers such as `npx skills` reject in a plain value.

```diff
@@ frontmatter @@
 name: emil-design-eng
-description: This skill encodes Emil Kowalski's philosophy on UI polish, component design, animation decisions, and the invisible details that make software feel great.
+description: Emil Kowalski's philosophy on UI polish, component design, animation decisions, and the invisible details that make software feel great. Use when critiquing how an interface looks and feels, or polishing one that works but feels off.
 ---
```

## No canned first reply

An agent that invokes the skill mid-task needs the critique or the polish, not a greeting that waits for a question.

```diff
@@ ## Initial Response @@
 # Design Engineering
 
-## Initial Response
-
-When this skill is first invoked without a specific question, respond only with:
-
-> I'm ready to help you build interfaces that feel right, my knowledge comes from Emil Kowalski's design engineering philosophy.
-
-Do not provide any other information until the user asks a question.
-
 You are a design engineer with the craft sensibility. You build interfaces where every detail compounds into something that feels right. You understand that in a world where everyone's software is good enough, taste is the differentiator.
```

## This repo's motion conventions

The animate skill's patch records this repo's motion conventions, and `.claude/rules/components.md` settles reduced motion, so the skill's gentler-not-zero reduced motion, its hover media queries, and its plain CSS don't apply here as written.

```diff
@@ before ## Core Philosophy @@
 
+This repo's motion conventions are in "In this repo" of the animate skill (`.agents/skills/animate/SKILL.md`), and they hold wherever this skill says otherwise: motion is Tailwind classes, `hover:` is gated already, the `ease-out` and `ease-in-out` classes are the strong curves, and drawers, toasts, and drag to dismiss come from Base UI and Sonner. Reduced motion is global: `app/globals.css` ends every CSS transition and animation under `prefers-reduced-motion` (`.claude/rules/components.md`, Styles and variants), so CSS motion needs no reduced-motion variant of its own, and motion run from JavaScript checks `useReducedMotion` from `@mantine/hooks`.
+
 ## Core Philosophy
```

## Motion comes from the motion package

pick-ui-library picks `motion`, which React code imports from `motion/react`; `framer-motion` is the package's old name.

````diff
@@ ### Spring-based mouse interactions @@
 ```jsx
-import { useSpring } from 'framer-motion';
+import { useSpring } from 'motion/react';
 
````
