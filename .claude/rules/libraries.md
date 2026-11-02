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
- Forms: `@tanstack/react-form`, with Base UI `Field` from `@/components/ui/field`
- Charts: `@tanstack/react-charts`
- i18n: `next-intl`, set up in `lib/i18n/` ([i18n.md](i18n.md))
- Dates, times, and numbers ([Dates and numbers](i18n.md#dates-and-numbers)): show a date or time with `<DateTime>` from `@/components/date-time`, which ESLint enforces; format relative times and numbers with next-intl's `useFormatter` and `getFormatter`; do date math with native `Date`, and `dayjs` for what it can't handle
- IDs: `nanoid`
- Domain-neutral hooks (debounce, intersection, media queries, element size…): `@mantine/hooks`. Write one in `hooks/` only for behavior it lacks.

For any other need, use the pick-ui-library skill before adding a dependency.
