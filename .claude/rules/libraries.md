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

UI libraries, used through their wrappers in `components/ui/` ([Wrap a UI library](design-system.md#wrap-a-ui-library)):

- UI primitives: `@base-ui/react`
- Toasts: `sonner`
- OTP inputs: `input-otp`

ESLint enforces this list through `wrappedPackages` in `scripts/eslint/architecture/plugin.mjs`: when the template wraps another UI library, change both together. A project made from the template adds a UI library it wraps itself through the `uiLibraries` option of `architecture/wrapper-imports` in its `eslint.config.project.mjs`, leaving `plugin.mjs` as it is.

Used directly:

- Icons: `@tabler/icons-react`
- i18n: `next-intl`, as [i18n.md](i18n.md) describes
- URL state: `nuqs`, as [URL state](data-flow.md#url-state) describes
- Forms: `@tanstack/react-form`, with Base UI `Field` in `components/ui/field/`
- Shared client state: `zustand`, its stores in a feature's `stores/` ([Feature structure](architecture.md#feature-structure))
- Charts: `@tanstack/react-charts`
- Dates, times, and numbers: show them as [Dates and numbers](i18n.md#dates-and-numbers) says; do date math with native `Date`, and `dayjs` for what it can't handle
- IDs: `nanoid`
- Domain-neutral behavior (debounce, timers, clipboard, intersection, media queries, element size…), whether a component or a hook needs it: `@mantine/hooks`. Write a hook in `hooks/` only for behavior it lacks.

For any other need, use the pick-ui-library skill before adding a dependency.
