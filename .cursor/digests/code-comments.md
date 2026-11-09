---
source: .claude/rules/code-comments.md
source-sha256: 3c17cf35716097c6b7598d1117d8eeae1314dc9ca646175cdd9cdf8ea3b23a0a
---

- A comment adds only what a maintainer would otherwise miss and could break; one repeating the code or explaining the current task is omitted.
- A requirement a type, assertion or test could enforce is enforced there rather than commented.
- Complex business rules and edge cases, workarounds and legacy behavior (with why they stay), hard optimizations or algorithms, security, concurrency or transaction guarantees, and relied-on external conventions get a comment when the code does not show them, naming the rule and what breaks if violated, not "do not touch".
- Comments state today's facts and why the code is so; before/after comparisons, migration history, alternatives and review discussion go in Git, specs or PRs.
- A reference names its file, function, constant, ticket ID or doc link.
- A comment on other code's behavior names that code and matches what it does; "handled upstream" or "guaranteed by the caller" needs verifiable evidence and never replaces validation, dependency entries or error handling.
- Each reason is explained once, where its rule lives, and only referenced elsewhere.
- A comment sits immediately above its code; a short one may end the line.
- Implementation comments usually run 1–3 lines, preferably 5 at most; a block past 10 lines usually moves its detail to a repo doc, leaving what a safe change needs and the doc's path.
- Public functions, classes, modules and APIs get a standard doc comment stating purpose and, where applicable, caller preconditions, side effects and failure behavior; it holds what callers need, not types the declaration shows.
- A TODO, FIXME or HACK states the problem or why the code stays, the next action or removal condition, and any ticket ID.
- Obsolete code is deleted, not commented out.
- A change leaves no nearby or affected comment, or doc of an interface whose use it changes, outdated.
- Inaccurate comments, or missing ones safe maintenance needs, are defects, not wording issues.
