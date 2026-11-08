---
paths:
  - "**/*.tsx"
  - "**/*.jsx"
  - "**/components/**/*.ts"
  - "**/components/**/*.js"
  - "**/*.css"
---

# Components

Every UI task starts at [Reuse, compose, extend, or add](#reuse-compose-extend-or-add). [Use a component](#use-a-component) governs each place your code renders a project component. [Write a component](#write-a-component) governs each component you create, and each existing one whose public API you change.

## Reuse, compose, extend, or add

1. Search `components/ui/`, the rest of root `components/`, the owning feature's `components/`, and other features' public entries for components that cover the need. For each candidate, read its public entry and Props, its examples in `features/ui-catalog/components/<component-id>-examples/` when it has them, and its existing callers. Confirm its behavior, supported states, and required providers.
2. Compare the best-fitting candidate with the need, and take the least invasive action that covers it. The rows run from least to most invasive:

   | What the candidate lacks | Action |
   | --- | --- |
   | Nothing | Reuse it. |
   | A different arrangement or content | Compose its public parts, children, and props. |
   | A capability within its responsibility, including a library part it does not expose yet | Extend its public API. |
   | A distinct behavior or responsibility | Add a component. |

## Use a component

- Choose the appearance with the component's existing `variant` and `size`. The caller owns placement, surrounding spacing, and layout, and sets them through `className`, along with local adjustments such as a color for a state only this caller has. When a third caller repeats the same visual override, extend the component's variants or defaults instead; UI catalog examples do not count as callers.
- Give each trigger or control exactly one interactive DOM element. To make a trigger look like a project button, pass the button as its `render` prop, as `DeleteTaskDialog` in [`features/task/components/delete-task-dialog.tsx`](https://github.com/fhyfhyfhy/next-template/blob/main/features/task/components/delete-task-dialog.tsx) does with `<DialogTrigger render={<Button variant="ghost" />}>`; a button nested in another button or a link is invalid HTML.

## Write a component

1. Place it by [Shared code ownership](architecture.md#shared-code-ownership). When extracting shared code, or adding a design-system primitive for its first consumer, apply [Duplication and abstraction](architecture.md#duplication-and-abstraction). Keep a simple component in one file; give one that needs private files or several public parts a component directory ([Component directories](architecture.md#component-directories)).
2. Define the public API. A design-system primitive in `components/ui/` may offer, beyond what its callers use now, the variants, sizes, and parts that shadcn/ui's version of it, when there is one, and the underlying library provide. Every other component offers the smallest public API its current callers need: what they can render, which visual variants they choose, which state they control or leave to the component, and which events they handle. Follow the names and defaults of nearby components. When the public API changes, update every caller in the same change.
3. Implement it by [Public API](#public-api) and [Styles and variants](#styles-and-variants), and a wrapper around a UI library also by [Wrap a UI library](#wrap-a-ui-library). When ESLint's size warning fires, apply [Split by responsibility](#split-by-responsibility).

### Public API

When designing or refactoring a component API, composing public parts, sharing state between parts, or reviewing component architecture, read [React Composition Patterns](../../.agents/skills/vercel-composition-patterns/SKILL.md) and follow the relevant files in its `rules/` directory. This rule and [architecture.md](architecture.md) decide where its patterns live.

- Declare components as named `export function` declarations. Files the framework loads follow its export convention, such as the default export of Next.js `page.tsx` and `layout.tsx`.
- Keep controlled state in the caller: accept the value and its change callback together, and read the value from props on every render rather than copying it into local state. For uncontrolled use, accept a default-value prop and let the underlying primitive own the state. Pass the callback's arguments, event details, and cancellation through unchanged.
- Represent independent behavior, such as `disabled`, with a state prop, separate from `variant` and `size`.
- Export each part of a compound component that callers arrange as a named export, as `components/ui/` does: a Server Component cannot read static members such as `Menu.Item` from an imported client reference. Show in its UI catalog examples (`features/ui-catalog/components/<component-id>-examples/`) which root owns the state, which parts belong inside it, and which providers are required.
- A component used as a render target passes the supplied ref and element props to its DOM element, handling `ref` per [React conventions](react.md).

### Styles and variants

Write static styles as Tailwind CSS class strings. Build variants with `cva` and merge classes with `cn`:

```tsx
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";
```

- Define `cva` variants beside their component and derive the variant types with `VariantProps`. Move them into a `variants.ts`, as in `components/ui/select/variants.ts`, only when compound parts sharing those types would otherwise import each other in a cycle, or when Server Components use the variants of a Client Component: a function exported from a `"use client"` module reaches a Server Component only as a client reference, which it cannot call.
- Combine conditional classes with `cn`, and pass the caller's `className` as its second and last argument: `cn(componentVariants({ variant, size }), className)`. Only in that position does `cn` resolve a Base UI function `className` against the component state; in a later position it drops the function.
- Keep the project's visual design in the theme tokens of `app/globals.css`: semantic colors, typography, control dimensions, radii, and shadows. A new shared design value becomes a token beside them. Name semantic colors and pair each background with its foreground as [shadcn/ui Theming](https://ui.shadcn.com/docs/theming) does, taking the values from the project's palette.
- After adding a token, check that `cn` merges its class with a built-in class of the same utility, as `cn("rounded-control", "rounded-lg")` returns `"rounded-lg"`. When both classes stay, `cn` cannot tell that they conflict: register the token under its theme key in the `theme` that `lib/cn.ts` passes to `createCn`, as `radius: ["control", "panel"]` registers `rounded-control`.
- Use `variant` and `size` for stable visual choices, following the existing names and defaults.
- Style interaction states from the primitive's data attributes, such as `data-checked:` and `data-disabled:` in `components/ui/checkbox/root.tsx`, or from native pseudo-classes such as `focus-visible:`.
- Pass computed values through CSS variables or inline styles.

### Wrap a UI library

- Before adding or changing a wrapper in `components/ui/`, read the matching [shadcn/ui source](https://github.com/shadcn-ui/ui/tree/main/apps/v4/registry/bases/base/ui), the library's official API reference, and the installed package's public types. Refer to shadcn/ui for wrappers, prop handling, and variant organization; where they differ, the project architecture, the project's existing names and tokens, and the installed library's API and component boundaries win.
- Keep the library's component boundaries: wrap and export each part separately, and let callers assemble them. Base UI's `Dialog.Portal`, `Dialog.Backdrop`, and `Dialog.Popup` stay separate public components, each with its own props and styling entry points. Re-export a part that needs no adaptation directly, as `DialogRoot` in `components/ui/dialog/index.ts`.
- Derive the wrapper's Props from the underlying component's exported types, preserving its generics, and add project-specific props explicitly. Document any omitted prop or changed semantics at the public interface.
- Take wrapper-only props out before forwarding the rest. Where the wrapper and the caller both set a class, style, ref, or handler, merge the two and confirm which wins, since a plain spread keeps only one: `cn` merges classes, and `mergeProps` from `@base-ui/react/merge-props` merges styles and handlers but not `ref`, as `Badge` in `components/ui/badge.tsx` uses it.
- Let the library handle the interactions it provides, such as keyboard navigation and focus management. The wrapper adds project styles, defaults, and the behavior the library lacks.

### Split by responsibility

An ESLint size warning triggers a responsibility review. Thresholds, counting rules, and exclusions live in [eslint.config.mjs](../../eslint.config.mjs); a component with one clear responsibility may stay whole.

Look for independent state or effects, JSX with its own UI meaning that obscures the parent's structure, or changes that require understanding unrelated behavior. Extract by responsibility:

| Responsibility | Extract into |
| --- | --- |
| A toolbar, list item, empty state, or other meaningful UI block | A private subcomponent |
| Independent state, subscriptions, or interaction logic | A hook |
| Formatting, calculation, or filtering | A pure function |

Splitting is complete when the parent shows the overall flow and each part changes for its own reason. Keep short, single-use JSX without a meaning of its own inline.

## Examples and verification

Finish every UI change with the checks below that apply.

- Before adding a public component in `components/ui/`, changing its public API, or editing UI catalog examples, read [ui-catalog.md](ui-catalog.md), and update the affected runnable examples in the same change.
- Check each affected scenario in a browser against its expected appearance, behavior, and accessibility: design-system components on `/ui` (under the basePath when the project has one), every other component on the pages that render it.
