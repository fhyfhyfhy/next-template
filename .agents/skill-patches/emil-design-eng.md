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

This repo keeps its motion conventions in `.claude/rules/components.md` and its library picks in `.claude/rules/libraries.md`, so the skill's gentler-not-zero reduced motion, its hover media queries, and its plain CSS don't apply here as written.

```diff
@@ before ## Core Philosophy @@
 
+Motion follows `.claude/rules/components.md`, Styles and variants, and components come from the libraries in `.claude/rules/libraries.md`; both hold wherever this skill says otherwise, including its reduced-motion handling, hover media queries, curve definitions, and hand-built drawers and toasts.
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
