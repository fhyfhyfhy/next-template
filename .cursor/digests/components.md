---
source: .claude/rules/components.md
source-sha256: 8dda85cb44ad817db45eeb6c23e70c08bba453b6ca524105712a5821625ac1a2
---

### Using components

- A new component must not duplicate one in `components/ui/`, root `components/`, the owning feature's `components/` or another feature's public entry: reuse it, compose its parts and props, or extend its public API; add one only for a distinct behavior or responsibility.
- Callers pick appearance with existing `variant` and `size`, and set placement, spacing, layout and caller-only tweaks via `className`; an override a third caller repeats (catalog examples aside) moves into the component's variants or defaults.
- Each trigger or control is one interactive DOM element: a trigger styled as a button takes it as its `render` prop; a button nested in a button or link is invalid HTML.

### Writing components

- A component with private files or several public parts is a directory, one level deep, split into sibling directories past ~5–7 files; its `index` exports what callers need, its contexts, hooks, helpers and types stay beside its parts, implementation-only symbols private.
- A `components/ui/` primitive may also offer the variants, sizes and parts that shadcn/ui's version, if any, and the library provide; any other component offers the smallest API its current callers need.
- Every component follows nearby components' names and defaults; a public API change updates every caller in the same change.
- Components are named `export function` declarations, except framework-loaded files like `page.tsx`.
- Controlled state: value and change callback together, the value read from props each render, never copied into local state. Uncontrolled: a default-value prop, the primitive owning the state, not the wrapper's `useState`. Callback arguments, event details and cancellation pass through unchanged.
- Independent behavior such as `disabled` is a state prop, not a `variant` or `size`.
- Compound parts callers arrange are named exports, not static members such as `Menu.Item`, which a Server Component cannot read from a client reference.
- A component used as a render target passes the supplied `ref` and element props to its DOM element.
- A split moves a meaningful UI block into a private subcomponent, independent state or logic into a hook, calculation into a pure function; short single-use JSX stays inline.
- Adding a `components/ui/` component or changing its public API updates its examples in `features/ui-catalog/components/<component-id>-examples/` in the same change; for a compound component they show the state-owning root, its parts and required providers.

### Styles

- Static styles are Tailwind class strings.
- Variants use `cva` and classes merge with `cn`, not a hand-written map or `clsx`/`join`. `cva` variants sit beside their component, typed with `VariantProps`; a `variants.ts` only breaks an import cycle between compound parts or serves Server Components using a Client Component's variants, as they cannot call a function from a `"use client"` module.
- `cn` takes the caller's `className` as its second and last argument, `cn(componentVariants({ variant, size }), className)`; elsewhere it drops a Base UI function `className`.
- The project's own design values (semantic colors, typography, control dimensions, radii, shadows) are theme tokens in `app/globals.css`; a new shared value becomes one, each semantic background paired with its foreground as shadcn/ui does.
- A new token whose class `cn` keeps beside the built-in class of its utility (`rounded-control`, `rounded-lg`) is registered in the `theme` `lib/cn.ts` passes to `createCn`, as `cn` cannot tell they conflict.
- Interaction states style from the primitive's data attributes (`data-checked:`) or native pseudo-classes (`focus-visible:`).

### Wrapping a UI library

- Where shadcn/ui's names or tokens differ from the project's, the project's win.
- Each library part (Base UI's `Dialog.Portal`, `Dialog.Backdrop`, `Dialog.Popup`) is wrapped and exported separately for callers to assemble; one needing no adaptation is re-exported directly.
- Props derive from the library's exported types, keeping generics, with project props added explicitly; omitted props or changed semantics are documented at the interface.
- Wrapper-only props are removed before forwarding. A class, style, ref or handler both wrapper and caller set is merged, confirming which wins, as a plain spread keeps one: `cn` for classes, `mergeProps` from `@base-ui/react/merge-props` for styles and handlers, `ref` merged apart as `mergeProps` skips it.
- Interactions the library provides, such as keyboard navigation and focus management, stay with it.
