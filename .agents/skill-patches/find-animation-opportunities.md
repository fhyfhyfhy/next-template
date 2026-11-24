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

This repo keeps its motion conventions in `.claude/rules/components.md` and its library picks in `.claude/rules/libraries.md`, so the gentler-not-zero reduced motion and the hover media query the skill asks of every suggestion don't apply here, and a suggestion's values are the repo's classes.

```diff
@@ before ## Operating Posture @@
 
+Motion follows `.claude/rules/components.md`, Styles and variants, and components come from the libraries in `.claude/rules/libraries.md`; both hold wherever this skill says otherwise, including its reduced-motion handling, hover media queries, curve definitions, and hand-built drawers and toasts. A suggestion gives its values as Tailwind classes and adds no reduced-motion variant or hover media query.
+
 ## Operating Posture
```
