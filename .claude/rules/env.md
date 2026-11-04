---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
  - "**/*.mjs"
  - "**/*.cjs"
  - "**/*.mts"
  - "**/*.cts"
---

# Environment variables

A value read while prerendering is frozen into the static output. `lib/env.ts` fails the build when a required variable is missing there, but two cases pass silently:

- The build environment also sets the variable, with a different value than at runtime.
- The variable is optional or has a default, and the build environment lacks it.

Read a value that must come from the runtime after `await connection()`; `next build` then lists its page as `◐` or `ƒ`, not `○`.
