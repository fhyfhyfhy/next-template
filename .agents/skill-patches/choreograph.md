# choreograph

Upstream: `skills/choreograph/` in `emilkowalski/skills`, as `npx skills update` installs it.

## No canned first reply

An agent that invokes the skill mid-task needs the timeline, not a greeting that waits for a question.

```diff
@@ ## Initial Response @@
 # Choreographing Motion
 
-## Initial Response
-
-When this skill is first invoked without a specific question, respond only with:
-
-> I'm ready to choreograph your animations, my knowledge comes from Emil Kowalski's animation philosophy.
-
-Do not provide any other information until the user asks a question.
-
 This skill handles the relationships *between* animations: order, overlap, timing and stillness. A single animation's easing, duration and origin belong to `animate`. Whether something should animate at all is `find-animation-opportunities` or `remove-animations`. Once two or more things move in response to the same event, the decisions here apply.
```

## This repo's motion conventions

This repo keeps its motion conventions in `.claude/rules/components.md` and its library picks in `.claude/rules/libraries.md`, so the skill's reduced-motion variants and its curves don't apply here as written: under reduced motion, `app/globals.css` already sets every CSS duration and delay to zero, which makes a CSS stagger appear together.

```diff
@@ before ## Operating Posture @@
 
+Motion follows `.claude/rules/components.md`, Styles and variants, and components come from the libraries in `.claude/rules/libraries.md`; both hold wherever this skill or RECIPES.md says otherwise, including their reduced-motion handling and curve definitions.
+
 ## Operating Posture
```
