---
paths:
  - "components/ui/**"
  - "app/globals.css"
  - "lib/cn.ts"
  - "lib/cn.test.mjs"
---

# Design system

The wrappers in `components/ui/` and the theme tokens in `app/globals.css`. [components.md](components.md) governs them as it does every component; this rule adds what only they need.

## Wrap a UI library

- Before adding or changing a wrapper in `components/ui/`, read the matching [shadcn/ui source](https://github.com/shadcn-ui/ui/tree/main/apps/v4/registry/bases/base/ui), the library's official API reference, and the installed package's public types. Refer to shadcn/ui for wrappers, prop handling, and variant organization; where they differ, the project architecture, the project's existing names and tokens, and the installed library's API and component boundaries win.
- Keep the library's component boundaries: wrap and export each part separately, and let callers assemble them. Base UI's `Dialog.Portal`, `Dialog.Backdrop`, and `Dialog.Popup` stay separate public components, each with its own props and styling entry points. Re-export a part that needs no adaptation directly, as `DialogRoot` in `components/ui/dialog/index.ts`.
- Derive the wrapper's Props from the underlying component's exported types, preserving its generics, and add project-specific props explicitly. Document any omitted prop or changed semantics at the public interface.
- Take wrapper-only props out before forwarding the rest. Where the wrapper and the caller both set a class, style, ref, or handler, merge the two and confirm which wins, since a plain spread keeps only one. Take the caller's `className` out and merge it with `cn`: `mergeProps` from `@base-ui/react/merge-props` only concatenates classes. Merge styles and handlers with `mergeProps`, the wrapper's props first and the caller's last, as `Badge` in `components/ui/badge.tsx` does; merge `ref` yourself, since `mergeProps` keeps only the last one.
- Let the library handle the interactions it provides, such as keyboard navigation and focus management. The wrapper adds project styles, defaults, and the behavior the library lacks.

## Theme tokens

- Add a token beside the existing ones in the `@theme` of `app/globals.css`. Name semantic colors and pair each background with its foreground as [shadcn/ui Theming](https://ui.shadcn.com/docs/theming) does, taking the values from the colors already in `:root` and `.dark` of `app/globals.css` where one fits, and asking the user for a color they lack.
- After adding a token, confirm in the browser's computed styles that its utility reads it: a built-in utility of the same name wins, as `max-w-prose` stays Tailwind's `65ch` and never reads a `--container-prose` token. Then add a case to a test beside `lib/cn.ts`, as in `lib/cn.test.mjs`, checking that `cn` merges its class with a built-in class of the same utility, as `cn("rounded-control", "rounded-lg")` returns `"rounded-lg"`. When both classes stay, `cn` cannot tell that they conflict: register the token under its theme key in the `theme` that `lib/cn.ts` passes to `createCn`, as `radius: ["control", "panel"]` registers `rounded-control`.
