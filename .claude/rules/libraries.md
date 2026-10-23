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
  - "package.json"
---

# Third-party libraries

| Purpose | Use | Don't use |
| --- | --- | --- |
| Icons | `@tabler/icons-react` | lucide, heroicons, custom SVG icon components |
| Dates | Native APIs (`Intl.DateTimeFormat`, `Date`) first; `dayjs` only for what they can't handle | moment, date-fns |
| Forms | `react-hook-form` | formik |
| ID generation | `nanoid` | `uuid`, `ulid`, `crypto.randomUUID()`, IDs built from `Math.random()` |
