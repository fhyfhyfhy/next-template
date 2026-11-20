# animate

Upstream: `skills/animate/` in `emilkowalski/skills`, as `npx skills update` installs it.

## No canned first reply

An agent that invokes the skill mid-task needs the animation built, not a greeting that waits for a question.

```diff
@@ ## Initial Response @@
 # Building Animations
 
-## Initial Response
-
-When this skill is first invoked without a specific question, respond only with:
-
-> I'm ready to build animations that feel right, my knowledge comes from Emil Kowalski's animation philosophy.
-
-Do not provide any other information until the user asks a question.
-
 A construction skill. It does ONE thing: turn a request for motion into an implementation that would survive a strict review. It does not audit a codebase (that's `improve-animations`), critique a diff (that's `review-animations`), hunt for places that could animate (that's `find-animation-opportunities`), or build for React Native (that's `animate-expo`).
```

## This repo's motion conventions

This repo keeps its motion conventions in `.claude/rules/components.md` and its library picks in `.claude/rules/libraries.md`, so the skill's plain CSS, its gentler-not-zero reduced motion, its hover media queries, its curve tokens, and its hand-built drawers and toasts don't apply here as written.

```diff
@@ before ## Operating Posture @@
 
+Motion follows `.claude/rules/components.md`, Styles and variants, and components come from the libraries in `.claude/rules/libraries.md`; both hold wherever this skill or RECIPES.md says otherwise, including their reduced-motion handling, hover media queries, curve definitions, and hand-built drawers and toasts.
+
 ## Operating Posture
```
