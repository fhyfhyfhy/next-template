---
paths:
  - "app/**"
  - "features/**"
  - "components/**"
  - "hooks/**"
  - "lib/**"
  - "utils/**"
  - "package.json"
---

# Libraries

This repo's picks. They take precedence over the pick-ui-library skill.

UI libraries, used through their wrappers in `components/ui/` ([Wrap a UI library](components.md#wrap-a-ui-library)):

- UI primitives: `@base-ui/react`
- Toasts: `sonner`
- OTP inputs: `input-otp`

ESLint enforces this list through `wrappedPackages` in `scripts/eslint/architecture/plugin.mjs`; when you wrap another UI library, change both together.

Used directly:

- Icons: `@tabler/icons-react`
- Forms: `@tanstack/react-form`, with Base UI `Field` in `components/ui/field/`. TanStack Form's validators hold every constraint: `Form` in `components/ui/form.ts` checks a control's native ones, such as `required`, `type="email"`, or `min`, before `onSubmit`, so a failing one blocks the submit before TanStack Form runs, showing the browser's message or nothing.
- Charts: `@tanstack/react-charts`
- Dates, times, and numbers: show them as [Dates and numbers](i18n.md#dates-and-numbers) says; do date math with native `Date`, and `dayjs` for what it can't handle
- IDs: `nanoid`
- Domain-neutral behavior (debounce, timers, clipboard, intersection, media queries, element size…), whether a component or a hook needs it: `@mantine/hooks`. Write a hook in `hooks/` only for behavior it lacks.

For any other need, use the pick-ui-library skill before adding a dependency.
