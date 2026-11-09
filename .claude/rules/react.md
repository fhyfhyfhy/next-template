---
paths:
  - "**/*.tsx"
  - "**/hooks/**"
---

# React 19

The repo runs React 19 with React Compiler. Write the React 19 form of each API, and ESLint reports the legacy ones: a component reads `ref` from its props in place of `forwardRef`, a wrapper whose props extend the underlying component's forwards it with the spread, and `useImperativeHandle` takes that prop to expose a handle; the context itself is its provider in place of `<Context.Provider>`, read with `use(Context)`; `useActionState` comes from `react` in place of `useFormState`. When unsure of an API, read the [React reference](https://react.dev/reference/react) and the [React 19 release notes](https://react.dev/blog/2024/12/05/react-19).

## React Compiler

`reactCompiler` in `next.config.ts` memoizes components and hooks, so write values, callbacks, and components without `useMemo`, `useCallback`, or `memo`. Keep the existing ones: removing them can change what the compiler memoizes.

The compiler skips a component or hook that breaks the [Rules of React](https://react.dev/reference/rules), leaving it unmemoized. The `react-hooks` lint rules report what makes it skip, so keep each component passing them.

## Ref callbacks return their cleanup

A ref callback that sets something up returns the teardown. React calls it when the ref detaches and then skips calling the callback with `null`, so the teardown lives in the returned function, in place of a `node === null` branch:

```tsx
<div
  ref={(node) => {
    if (!node) return;
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }}
/>
```
