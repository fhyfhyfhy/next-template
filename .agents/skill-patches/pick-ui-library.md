# pick-ui-library

Upstream: `skills/pick-ui-library/` in `emilkowalski/skills`, as `npx skills update` installs it.

## Agents pick libraries on their own

This list is where agents in this repo look up which library to use, so it has to load whenever an agent chooses one, not only when a user invokes it.

```diff
@@ frontmatter @@
 name: pick-ui-library
-description: Pick the right library for a given frontend task from a curated, opinionated list — numbers, OTP inputs, charts, command menus, virtualization, drag and drop, toasts, state, styling, and more. Only runs when explicitly invoked; it does not trigger on its own.
-disable-model-invocation: true
+description: Pick the right library for a given frontend task from a curated, opinionated list — icons, dates, forms, IDs, numbers, OTP inputs, charts, command menus, virtualization, drag and drop, toasts, state, styling, and more. Use when choosing a library or adding a dependency.
 ---
```

## This repo's picks

The repo has settled on these for needs the upstream list leaves out.

```diff
@@ ### UI components & primitives @@
 | Unstyled, accessible UI components (dialogs, popovers, menus, selects…) | [base-ui](https://base-ui.com) |
+| Icons | [Tabler Icons](https://tabler.io/icons) (`@tabler/icons-react`) |
 | Command menus (⌘K palettes) | [cmdk](https://cmdk.paco.me) |
```

```diff
@@ end of ### State & styling @@
 The styling split: clsx for ad-hoc conditional classes; cva when a component has real variants (size, intent, state) that deserve a typed API. They compose — cva uses clsx-style inputs internally.
 
+### Dates, forms & IDs
+
+| Task | Library |
+| --- | --- |
+| Dates | Native `Intl.DateTimeFormat` and `Date`; [Day.js](https://day.js.org) for what they can't handle |
+| Forms | [React Hook Form](https://react-hook-form.com) |
+| Generating IDs | [nanoid](https://github.com/ai/nanoid) |
+
 ## Common mismatches to catch
```
