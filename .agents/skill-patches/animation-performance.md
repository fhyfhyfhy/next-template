# animation-performance

Upstream: `skills/animation-performance/` in `emilkowalski/skills`, as `npx skills update` installs it.

## No canned first reply

An agent that invokes the skill mid-task needs the diagnosis, not a greeting that waits for a question.

```diff
@@ ## Initial Response @@
 # Animation Performance
 
-## Initial Response
-
-When this skill is first invoked without a specific question, respond only with:
-
-> I'm ready to find out why your animation drops frames and make it smooth, my knowledge comes from Emil Kowalski's design engineering philosophy.
-
-Do not provide any other information until the user asks a question.
-
 A diagnostic skill. It does ONE thing: make motion land every frame. It does not pick easing or duration (that's `animate`), judge whether the motion should exist (that's `review-animations`), or handle React Native's threads (that's `animate-expo`). The question here is never "does it look right?" but "does each frame finish in time?".
```
