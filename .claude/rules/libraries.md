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

- UI primitives: `@base-ui/react`, wrapped in `components/ui/`
- Toasts: `sonner`
- OTP inputs: `input-otp`
- Icons: `@tabler/icons-react`
- Forms: `@tanstack/react-form`
- Charts: `@tanstack/charts`
- Dates: native `Intl.DateTimeFormat` and `Date`; `dayjs` for what they can't handle
- IDs: `nanoid`

For any other need, use the pick-ui-library skill before adding a dependency.
