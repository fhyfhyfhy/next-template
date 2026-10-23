---
paths:
  - "**/*.tsx"
  - "**/*.jsx"
  - "**/components/**/*.ts"
  - "**/components/**/*.js"
  - "**/*.css"
---

# Components

## Use an existing component

1. Search `components/ui/`, `components/`, and the owning feature's components, then read the candidate's public entry, Props, and usage examples. Confirm its behavior, supported states, and required providers before choosing it.
2. Choose the smallest change that covers the requested interaction:

   | What is missing? | Action |
   | --- | --- |
   | Nothing | Reuse the component. |
   | A different arrangement or content | Compose its public parts, children, and props. |
   | A capability that belongs to the same component's responsibility | Extend its public API and update affected callers. |
   | A distinct behavior or responsibility | Follow "Add or change a component" below. |

3. Import through the owner's public entry, following [Component directories](architecture.md#component-directories) and [Feature public API](architecture.md#feature-public-api). Prefer existing project components whenever they meet the UI's requirements, including page structure and content. Preserve semantic HTML whether using project components or native elements.
4. Prefer existing variants and sizes for component appearance. See "Styles and variants" below for local customization.

## Add or change a component

1. Determine the owner using [Shared code ownership](architecture.md#shared-code-ownership). Apply [Duplication and abstraction](architecture.md#duplication-and-abstraction) when extracting shared code or introducing a design-system primitive for its first consumer. Keep a simple component in one file. When it needs private implementation files or multiple public parts, use a component directory with a public index entry, following [Component directories](architecture.md#component-directories).
2. Define the smallest public API that satisfies current callers: what they can render, which visual variants they can choose, which state they control or leave to the component, and which events they can handle. Read nearby implementations for naming and defaults. For a public API change, search all callers and update their usage in the same change.
3. Implement the component using the contracts below. When wrapping a UI library, follow [Wrap a UI library](#wrap-a-ui-library). Keep business actions and decisions in the owning feature or caller.
4. Follow [Examples and verification](#examples-and-verification).

## Public API and composition

When designing or refactoring component APIs, composing public parts, sharing state between parts, or reviewing component architecture, read [React Composition Patterns](../../.agents/skills/vercel-composition-patterns/SKILL.md) and follow the relevant files in its `rules/` directory. Apply the project's ownership and public-entry rules when placing those implementations.

- Declare component implementations with named `export function` declarations. For files loaded by the framework, follow its export convention; for example, Next.js `page.tsx` and `layout.tsx` require default exports. A selected primitive part may be re-exported directly when it needs no adaptation; follow [Component directories](architecture.md#component-directories) instead of adding an empty wrapper.
- Derive wrapper Props from the underlying component's exported types, preserving its generics where applicable. Add project-specific props explicitly. Document intentional omissions or changed semantics at the public interface; avoid silently narrowing the underlying API.
- Keep controlled state in the caller and pass its value and change callback through together. For uncontrolled usage, pass default-value props and let the underlying primitive own the state. Avoid local mirrors of controlled props. Preserve the callback's arguments, event details, and cancellation behavior.
- Use defaults that callers can override for supported options. Consume wrapper-only props before forwarding the remaining props. Merge classes, styles, refs, and handlers where both layers contribute; verify precedence instead of relying on prop spread order to preserve both behaviors.
- For compound components, expose the parts callers need to arrange content and actions. Keep required relationships and setup discoverable in examples: which root owns the state, which parts belong inside it, and which providers are required. Business workflows compose those parts in their own owner.
- Components used as render targets must pass the supplied ref and element props to the underlying DOM element. Follow [React conventions](react.md) for ref handling. When composing triggers and controls, use a single interactive DOM element. Avoid invalid nesting such as a button inside another button or a link.

## Wrap a UI library

- Before adding or changing a component in `components/ui/`, read the matching [shadcn/ui source](https://github.com/shadcn-ui/ui/tree/main/apps/v4/registry/bases) for the project's selected underlying library. Refer to its wrappers, prop handling, and variant organization. Project architecture and the underlying library's API and component boundaries take precedence when adapting the reference.
- Place wrappers for the project's chosen UI library in `components/ui/`. Callers import UI components through the project's public entries. When a caller needs a part of the underlying library that the project component does not expose, add that part to the project component and its public exports.
- Preserve the library's original component boundaries: wrap and export each part separately, and let callers assemble them. For example, Base UI's `Dialog.Portal`, `Dialog.Backdrop`, and `Dialog.Popup` remain separate public components, each retaining its own props and styling entry points.
- Before wrapping a library component or changing its behavior, read its official API reference and check the installed package's public types. Resolve differences against the installed version.
- Use the library's documented composition and styling APIs. Let the underlying library handle the interactions it provides, such as keyboard navigation and focus management. The wrapper adds project styles, defaults, and required behavior that the library does not provide.

## Styles and variants

### Styling tools

Write static styles as Tailwind CSS class strings. Use these imports for variants and class merging:

```tsx
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";
```

- Define `cva` variants alongside their component and derive variant types with `VariantProps`. Extract `variants.ts` only when sharing those inferred types across compound parts would otherwise create circular imports.
- Use the project's `cn` for conditional class names and merging Tailwind classes; extend its theme configuration for custom tokens. Merge caller-provided `className` after component styles: `cn(componentVariants({ variant, size }), className)`.

### Theme and variants

- Keep the project's own visual design in shared theme tokens: semantic colors, typography, control dimensions, radii, and shadows. Components reference those tokens; a new shared design value belongs beside the existing tokens.
- Follow [shadcn/ui Theming](https://ui.shadcn.com/docs/theming) for semantic color-token names and meanings, including background/foreground pairs. Assign values from the project's own palette.
- Use `variant` and `size` for stable visual choices, following existing names and defaults. Add options for current needs. Represent independent behavior such as `disabled` with a state prop.

### Caller customization

Callers own placement, surrounding spacing, and layout. Use `className` for these and necessary local customization. Customize styles through public props or exposed component parts. Repeated visual overrides are a signal to revisit the component's variants or defaults.

### Dynamic values and interaction states

- Use CSS variables or inline styles for computed values.
- Derive interaction styles directly from the primitive's state hooks or native selectors.

## Split by responsibility

An ESLint size warning triggers a responsibility review. Thresholds, counting rules, and exclusions live in [eslint.config.mjs](../../eslint.config.mjs); a component with one clear responsibility may remain intact.

Check for independent state or effects, JSX with its own UI meaning that obscures the parent structure, or changes that require understanding unrelated behavior. Extract according to the responsibility:

| Responsibility | Extract into |
| --- | --- |
| A toolbar, list item, empty state, or other meaningful UI block | A private subcomponent |
| Independent state, subscriptions, or interaction logic | A hook |
| Formatting, calculation, or filtering | A pure function |

Apply the ownership and private-boundary rules when placing the result. Splitting is complete when the parent exposes the overall flow and each part changes for its own reason. Keep short, single-use JSX inline when it has no independent meaning.

## Examples and verification

Before adding a public component in `components/ui/` or root `components/`, changing its API, or editing showcase demos/examples, read [Showcase examples](../../README.md#showcase-examples). Include affected runnable examples in the same change.

Verify affected scenarios in a browser against their expected appearance, behavior, and accessibility requirements. Use `/showcase` for shared components and actual pages for feature-specific components and private subcomponents.
