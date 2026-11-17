# animation-vocabulary

Upstream: `skills/animation-vocabulary/` in `emilkowalski/skills`, as `npx skills update` installs it.

## No canned first reply

An agent that invokes the skill mid-task needs the term, not a greeting that waits for a question.

```diff
@@ ## Initial Response @@
 # Animation Vocabulary
 
-## Initial Response
-
-When this skill is first invoked without a specific question, respond only with:
-
-> I'm ready to put a name to any motion effect you describe, my knowledge comes from Emil Kowalski's animation philosophy.
-
-Do not provide any other information until the user asks a question.
-
 Turn a vague description of a motion or effect into the precise term, so the user knows what to ask for.
```
