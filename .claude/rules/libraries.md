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

# Libraries

This repo's picks. They take precedence over the pick-ui-library skill.

UI libraries, used through their wrappers ([Wrap a UI library](components.md#wrap-a-ui-library)):

- UI primitives: `@base-ui/react`
- Toasts: `sonner`
- OTP inputs: `input-otp`

Used directly:

- Icons: `@tabler/icons-react`
- Forms: `@tanstack/react-form`
- Charts: `@tanstack/react-charts`
- Dates: native `Intl.DateTimeFormat` and `Date`; `dayjs` for what they can't handle
- IDs: `nanoid`

For any other need, use the pick-ui-library skill before adding a dependency.
