---
paths:
  - "**/*.tsx"
  - "**/*.jsx"
  - "**/components/**/*.ts"
  - "**/components/**/*.js"
  - "**/_components/**/*.ts"
  - "**/_components/**/*.js"
  - "**/*.css"
---

# Components

When a task needs UI the code does not render yet, start at [Reuse, compose, extend, or add](#reuse-compose-extend-or-add). [Use a component](#use-a-component) governs each place your code renders a project component, and [Write a component](#write-a-component) each component you create or whose public API you change; its subsections also govern every other change to a component.

## Reuse, compose, extend, or add

1. Search `components/ui/`, the rest of root `components/`, the owning feature's `components/`, the `_components/` directories in `app/`, and other features' public entries for components that cover the need. For each candidate, read its public entry and Props, its examples in `features/ui-catalog/components/<component-id>-examples/` when it has them, and its existing callers. Confirm its behavior, supported states, and required providers.
2. Compare the best-fitting candidate with the need, and take the least invasive action that covers it. The rows run from least to most invasive:

   | What the candidate lacks | Action |
   | --- | --- |
   | Nothing | Reuse it. |
   | A different arrangement or content | Compose its public parts, children, and props. |
   | A capability within its responsibility, including a library part it does not expose yet | Extend its public API. |
   | A distinct behavior or responsibility | Add a component. |

## Use a component

- Choose the appearance with the component's existing `variant` and `size`. The caller owns placement, surrounding spacing, and layout, and sets them through `className`, along with local adjustments such as a color for a state only this caller has.
- To override a class the component sets under a prefix, such as `not-data-disabled:hover:bg-accent`, write yours under the same prefix: `cn` replaces a class only when the prefixes match, and a plain `hover:bg-card` loses to that more specific selector.
- When a third caller would make the same adjustment, whether a class or a prop value that tunes the component, such as a positioner's `sideOffset`, make it the component's default or variant and remove it from the other callers; choosing a `variant` or `size`, and the placement, surrounding spacing, and layout the caller owns, are not adjustments, and UI catalog examples do not count as callers.
- Give each trigger or control exactly one interactive DOM element. To make a trigger look like a project button, pass the button as its `render` prop, as `DeleteTaskDialog` in [`features/task/components/task-detail/delete-task-dialog.tsx`](https://github.com/fhyfhyfhy/next-template/blob/main/features/task/components/task-detail/delete-task-dialog.tsx) does with `<DialogTrigger render={<Button variant="ghost" />}>`; a button nested in another button or a link is invalid HTML.
- Disable the fields and submit button of a form that submits through JavaScript, and any other controlled field that hydration would reset, until the page hydrates, with `useHydrated` in `hooks/use-hydrated.ts`, as `CreateTaskForm` in [`features/task/components/create-task-form.tsx`](https://github.com/fhyfhyfhy/next-template/blob/main/features/task/components/create-task-form.tsx) does: before then, the browser submits the form as a GET that reloads the page, and hydration erases what was typed.
- In a form whose values TanStack Form holds, put every constraint in its validators and leave native constraint attributes, such as `required`, `type="email"`, or `min`, off its controls: `Form` in `components/ui/form.ts` checks them before `onSubmit`, so a failing one blocks the submit before TanStack Form runs, showing the browser's message or nothing.
- Keep a button focusable while the action it started is pending, with `focusableWhenDisabled` beside `disabled`: a natively disabled button loses keyboard focus. A button also disabled until hydration takes `focusableWhenDisabled={hydrated}`, so its server-rendered HTML stays natively disabled.

## Write a component

1. Place it by [Shared code ownership](architecture.md#shared-code-ownership). When it repeats code or structure that exists elsewhere, extracts shared code, or is a design-system primitive for its first consumer, apply [Duplication and abstraction](architecture.md#duplication-and-abstraction). Make it a single file or a component directory by [Component directories](#component-directories).
2. Define the public API. A design-system primitive in `components/ui/` may offer, beyond what its callers use now, the variants, sizes, and parts that shadcn/ui's version of it, when there is one, and the underlying library provide. Every other component offers the smallest public API its current callers need: what they can render, which visual variants they choose, which state they control or leave to the component, and which events they handle. Follow the names and defaults of nearby components. When the public API changes, update every caller in the same change.
3. Implement it by [Public API](#public-api) and [Styles and variants](#styles-and-variants), and a wrapper around a UI library also by [Wrap a UI library](design-system.md#wrap-a-ui-library). Keep it to one responsibility by [Split by responsibility](#split-by-responsibility).

### Component directories

A simple component is a single file; its loading skeleton, when it has one, is a file of its own beside it, also when the component renders the skeleton itself. A component with private files, such as subcomponents or hooks of its own, or with several public parts, is a directory that holds that one component: either a main component with its private files and its loading skeleton, which the `index` exports beside it, or the public parts of one compound component, which callers arrange together. Give each independent component its own file or directory.

```
features/orders/components/
  order-editor/            ← main component
    index.tsx              ← entry and main component
    toolbar.tsx            ← private subcomponent
    status-bar.tsx
    skeleton.tsx           ← OrderEditorSkeleton, exported by the index
  order-list-navigation/   ← compound component
    index.ts               ← public entry: exports the parts by name
    root.tsx               ← OrderListNavigation, which holds the shared state
    link.tsx               ← OrderListLink
    context.ts             ← private, read by the parts
```

In the sample product, [`features/task/components/task-detail/`](https://github.com/fhyfhyfhy/next-template/tree/main/features/task/components/task-detail) is a main component with private subcomponents, and [`features/task/components/task-list-navigation/`](https://github.com/fhyfhyfhy/next-template/tree/main/features/task/components/task-list-navigation) a compound component whose parts share a context.

- The `index` is the directory's only entry: it exports by name each component, context, hook, and type that callers need, and nothing else.
- Keep component-specific contexts, hooks, helpers, and types alongside its parts. Extract them to the appropriate layer within their owner when they acquire an independent reuse role.
- A subcomponent rendered only from within one component directory goes in that directory, with the files only it uses beside it. It becomes a sibling component directory only when the split below moves it out, since component directories are one level deep.

Keep both levels readable: a component directory holds one component and the few files it needs, and a `components/` holds whole components, not fragments of them. Component directories are one level deep, so when one holds more than about 10 files, test files included, look in it for a **cohesive group**: a subcomponent together with the files only it uses. Move such groups into **sibling** component directories named for them, until the directory is back to about 10 files or no group is left:

```
features/orders/components/
  order-editor/            ← main component
    index.tsx
    status-bar.tsx
  order-editor-toolbar/    ← split-out group: the toolbar and the button only it uses
    index.tsx
    format-button.tsx
```

Each split-off directory is a component in its own right, one a reader can name without knowing its parent. In the sample product, [`features/task/components/task-heading/`](https://github.com/fhyfhyfhy/next-template/tree/main/features/task/components/task-heading) left `task-detail/` when it passed 10 files: the heading, with the live status and rename form only it renders. A directory with no such group stays whole; check its main component against [Split by responsibility](#split-by-responsibility) instead.

Two kinds of directory stay whole however many files they hold: a compound component's, whose parts would otherwise reach callers through two entries, as in `components/ui/select/`; and a UI catalog `<component-id>-examples/` directory, which keeps every file at its top level ([ui-catalog.md](ui-catalog.md#examples)).

### Public API

When a component's props start to switch what it renders, or its parts share state, read [React Composition Patterns](../../.agents/skills/vercel-composition-patterns/SKILL.md) and follow the files in its `rules/` that match. Where the skill differs from this project's rules, the rules win, as on where its patterns live and how parts are exported. A compound component's root holds the shared state and provides a context of just the values its parts read, as `TaskListNavigation` in [`features/task/components/task-list-navigation/root.tsx`](https://github.com/fhyfhyfhy/next-template/blob/main/features/task/components/task-list-navigation/root.tsx) does. Leave server data with its owner ([Copies](data-flow.md#copies)), and add a `state`/`actions`/`meta` interface once a second provider needs to implement it.

- Declare components as named `export function` declarations. Files the framework loads follow its export convention, such as the default export of Next.js `page.tsx` and `layout.tsx`.
- Keep controlled state in the caller: type a value prop you define so that a caller passing it must pass its change callback too, and read the value from props on every render rather than copying it into local state. For uncontrolled use, accept a default-value prop and let the underlying primitive own the state. Pass the callback's arguments, event details, and cancellation through unchanged.
- Use `variant` and `size` for stable visual choices, and a separate state prop, such as `disabled`, for independent behavior.
- Export each part of a compound component that callers arrange as a named export, as `components/ui/` does: a Server Component cannot read static members such as `Menu.Item` from an imported client reference.
- A component used as a render target passes the supplied ref and element props to its DOM element, handling `ref` per [React conventions](react.md).

### Styles and variants

Write static styles as Tailwind CSS class strings. Build variants with `cva` from `class-variance-authority`, and merge classes with `cn` in `lib/cn.ts`.

- Define `cva` variants beside their component and derive the variant types with `VariantProps`. Move them into a `variants.ts`, as in `components/ui/select/variants.ts`, only when compound parts sharing those types would otherwise import each other in a cycle, or when Server Components use the variants of a Client Component: a function exported from a `"use client"` module reaches a Server Component only as a client reference, which it cannot call.
- Combine conditional classes with `cn`, and pass the caller's `className` as its second and last argument: `cn(componentVariants({ variant, size }), className)`. Only in that position does `cn` resolve a Base UI function `className` against the component state; in a later position it drops the function.
- Keep the project's visual design in the theme tokens of `app/globals.css`: semantic colors, typography, control dimensions, radii, and shadows. Style with the tokens its `@theme` defines wherever one fits, such as `h-control-md` for a control's height. A new shared design value becomes a token beside them, added as [Theme tokens](design-system.md#theme-tokens) says.
- Style interaction states in the component, from the attribute that states each one: the primitive's data attributes, such as `data-checked:` and `data-disabled:` in `components/ui/checkbox/root.tsx`, an ARIA attribute the element carries, such as `aria-pressed:`, or a native pseudo-class such as `focus-visible:`. Give every element that can take focus a focus style of its own there, like the `focus-visible:` ring on the primitives in `components/ui/`, so no caller has to add one.
- Under `prefers-reduced-motion`, `app/globals.css` sets every CSS transition and animation duration to zero with `!important`, which no class overrides, so CSS motion needs no reduced-motion handling of its own, whatever the motion skills ask. Motion run from JavaScript checks the preference itself, with `useReducedMotion` from `@mantine/hooks`.
- Pass computed values through CSS variables or inline styles.

### Split by responsibility

[Single responsibility](architecture.md#single-responsibility) holds for a component of any size. An ESLint size warning is one sign to check it: thresholds, counting rules, and exclusions live in [eslint.config.mjs](../../eslint.config.mjs), and a component with one clear responsibility may stay whole.

Look for independent state or effects; JSX with its own UI meaning that obscures the parent's structure; formatting, calculation, or filtering mixed into rendering; and changes that require understanding unrelated behavior. Extract each into a private subcomponent, a hook, or a pure function, placed by [Component directories](#component-directories).

Splitting is complete when the parent shows the overall flow and each part changes for its own reason. Keep short, single-use JSX without a meaning of its own inline.

## Examples and verification

Finish every UI change with the checks below that apply.

- Ship a new public component in `components/ui/`, or a change to one's public API, with its UI catalog examples, written or updated by [ui-catalog.md](ui-catalog.md), in the same change.
- Check each affected scenario in a browser: design-system components on `/ui` (under the basePath when the project has one), every other component on the pages that render it. A scenario passes when it looks and behaves as the task asks, and every interactive element in it has an accessible name, shows its own focus style, and works from the keyboard alone.
