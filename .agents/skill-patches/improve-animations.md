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
