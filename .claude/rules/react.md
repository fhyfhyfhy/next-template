---
paths:
  - "**/*.tsx"
  - "**/hooks/**"
  - "**/use-*.ts"
---

# React 19

The repo runs React 19 with React Compiler. Write the React 19 form of each API. `ref` is a prop: a wrapper whose props extend the underlying component's forwards it with the spread, as `Input` in `components/ui/input.tsx` does, and `useImperativeHandle` takes it to expose a handle. When unsure of an API, read the [React reference](https://react.dev/reference/react) and the [React 19 release notes](https://react.dev/blog/2024/12/05/react-19).

## React Compiler

`reactCompiler` in `next.config.ts` memoizes components and hooks, so write values, callbacks, and components without `useMemo`, `useCallback`, or `memo`. Keep the existing ones: removing them can change what the compiler memoizes.

The compiler skips a component or hook that breaks the [Rules of React](https://react.dev/reference/rules), leaving it unmemoized. The `react-hooks` lint rules report what makes it skip, some only as warnings, and an `eslint-disable` of `react-hooks/rules-of-hooks` or `react-hooks/exhaustive-deps` makes it skip too: a component or hook is done when they report nothing on it and nothing disables them.

## Ref callbacks return their cleanup

A ref callback that sets something up, such as adding a listener, returns the teardown. React calls it when the ref detaches and then skips calling the callback with `null`, so the teardown lives in the returned function, in place of a `node === null` branch.
