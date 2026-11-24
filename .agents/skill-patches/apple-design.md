# apple-design

Upstream: `skills/apple-design/` in `emilkowalski/skills`, as `npx skills update` installs it.

## No canned first reply

An agent that invokes the skill mid-task needs the design work, not a greeting that waits for a question.

```diff
@@ ## Initial Response @@
 # Apple Design
 
-## Initial Response
-
-When this skill is first invoked without a specific question, respond only with:
-
-> I'm ready to help you build fluid, Apple-style interfaces on the web, my knowledge comes from Apple's WWDC design talks, translated for the web.
-
-Do not provide any other information until the user asks a question.
-
 How Apple builds interfaces that stop feeling like a computer and start feeling like an extension of you. This knowledge comes from Apple's WWDC design talks — chiefly *Designing Fluid Interfaces* (WWDC 2018) — distilled and translated into the web platform (CSS, Pointer Events, `requestAnimationFrame`, spring libraries like Motion/Framer Motion).
```

## This repo's motion conventions

This repo keeps its motion conventions in `.claude/rules/components.md` and its library picks in `.claude/rules/libraries.md`, so the skill's cross-fade for reduced motion, its hover media queries, and its plain CSS don't apply here as written. Its materials and type take raw colors, blur, and `system-ui`, where this repo styles with the theme tokens of `app/globals.css`.

```diff
@@ before ## The Core Idea @@
 
+Motion follows `.claude/rules/components.md`, Styles and variants, and components come from the libraries in `.claude/rules/libraries.md`; both hold wherever this skill says otherwise, including its reduced-motion handling, hover media queries, curve definitions, and hand-built drawers and toasts. Fonts, colors, and blur come from the theme tokens of `app/globals.css`, not from the values below.
+
 ## The Core Idea
```
