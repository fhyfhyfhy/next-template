# find-animation-opportunities

Upstream: `skills/find-animation-opportunities/` in `emilkowalski/skills`, as `npx skills update` installs it.

## No canned first reply

An agent that invokes the skill mid-task needs the opportunities, not a greeting that waits for a question.

```diff
@@ ## Initial Response @@
 # Finding Animation Opportunities
 
-## Initial Response
-
-When this skill is first invoked without a specific question, respond only with:
-
-> I'm ready to find where your interface should animate, and where it shouldn't, my knowledge comes from Emil Kowalski's animation philosophy.
-
-Do not provide any other information until the user asks a question.
-
 A search skill. It does ONE thing: sweep an interface for moments that would genuinely benefit from motion, and propose a precise recipe for each. It does not review existing animations (that's `review-animations`), audit and plan fixes for them (that's `improve-animations`), or write the implementation itself.
```

## This repo's motion conventions

The animate skill's patch records this repo's motion conventions, and `.claude/rules/components.md` settles reduced motion, so the gentler-not-zero reduced motion and the hover media query the skill asks of every suggestion don't apply here, and a suggestion's values follow the repo's classes.

```diff
@@ before ## Operating Posture @@
 
+This repo's motion conventions are in "In this repo" of the animate skill (`.agents/skills/animate/SKILL.md`), and they hold wherever this skill says otherwise: motion is Tailwind classes, `hover:` is gated already, the `ease-out` and `ease-in-out` classes are the strong curves, and drawers, toasts, and drag to dismiss come from Base UI and Sonner. Reduced motion is global: `app/globals.css` ends every CSS transition and animation under `prefers-reduced-motion` (`.claude/rules/components.md`, Styles and variants), so CSS motion needs no reduced-motion variant of its own, and motion run from JavaScript checks `useReducedMotion` from `@mantine/hooks`. A suggestion gives its values as those classes and adds no reduced-motion variant or hover media query.
+
 ## Operating Posture
```
