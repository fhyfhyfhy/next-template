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
- Forms: `@tanstack/react-form`. A form submitted to a Server Action uses `@tanstack/react-form-nextjs` the way `features/demo-task/components/create-task-form.tsx` does. It departs from the package's example where the example loses input: `useActionState` starts at `undefined`, each server state is merged once (Next's `<Activity>` re-runs the merge when the user returns to the page), and `onSubmit` blocks the native submit when browser validation fails.
- Charts: `@tanstack/react-charts`
- Dates: native `Intl.DateTimeFormat` and `Date`; `dayjs` for what they can't handle
- IDs: `nanoid`
- Domain-neutral hooks (debounce, intersection, media queries, element size…): `@mantine/hooks`. Write one in `hooks/` only for behavior it lacks.

For any other need, use the pick-ui-library skill before adding a dependency.
