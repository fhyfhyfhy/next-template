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

The animate skill's patch records this repo's motion conventions, and `.claude/rules/components.md` settles reduced motion, so the skill's cross-fade for reduced motion, its hover media queries, and its plain CSS don't apply here as written. Its materials and type take raw colors, blur, and `system-ui`, where this repo styles with the theme tokens of `app/globals.css`.

```diff
@@ before ## The Core Idea @@
 
+This repo's motion conventions are in "In this repo" of the animate skill (`.agents/skills/animate/SKILL.md`), and they hold wherever this skill says otherwise: motion is Tailwind classes, `hover:` is gated already, the `ease-out` and `ease-in-out` classes are the strong curves, and drawers, toasts, and drag to dismiss come from Base UI and Sonner. Reduced motion is global: `app/globals.css` ends every CSS transition and animation under `prefers-reduced-motion` (`.claude/rules/components.md`, Styles and variants), so CSS motion needs no reduced-motion variant of its own, and motion run from JavaScript checks `useReducedMotion` from `@mantine/hooks`. Fonts, colors, and blur come from the theme tokens of `app/globals.css` (`.claude/rules/design-system.md`), not from the values below.
+
 ## The Core Idea
```
