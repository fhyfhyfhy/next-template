---
paths:
  - "**/*.tsx"
  - "**/*.ts"
---

# React 19

The repo runs React 19 with React Compiler. Write the React 19 form of each API below; ESLint reports the legacy forms of `ref`, context, and action state. When unsure of an API, read the [React reference](https://react.dev/reference/react) and the [React 19 release notes](https://react.dev/blog/2024/12/05/react-19).

## React Compiler

`reactCompiler` in `next.config.ts` memoizes components and hooks, so write values, callbacks, and components without `useMemo`, `useCallback`, or `memo`. Keep the existing ones: removing them can change what the compiler memoizes.

The compiler skips a component or hook that breaks the [Rules of React](https://react.dev/reference/rules), leaving it unmemoized. The `react-hooks` lint rules report what makes it skip, so keep each component passing them.

## `ref` is a prop

A function component reads `ref` from its props, in place of `forwardRef`, which React 19 no longer needs and plans to deprecate:

```tsx
interface MyInputProps {
  placeholder?: string;
  ref?: Ref<HTMLInputElement>;
}

export function MyInput({ placeholder, ref }: MyInputProps) {
  return <input placeholder={placeholder} ref={ref} />;
}
```

A wrapper whose props extend the underlying component's props type receives `ref` among them and forwards it with the spread, as `Input` in `components/ui/input.tsx` does.

To expose an imperative handle, pass that prop to `useImperativeHandle`:

```tsx
interface ComposerProps {
  ref?: Ref<{ focus: () => void }>;
}

export function Composer({ ref }: ComposerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }));
  return <input ref={inputRef} />;
}
```

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

## Context

Render the context itself as its provider, in place of `<Context.Provider>`, which React plans to deprecate:

```tsx
const ThemeContext = createContext<Theme>(defaultTheme);

<ThemeContext value={theme}>{children}</ThemeContext>;
```

Read it with `use(Context)` in place of `useContext(Context)`. `use` may be called inside a condition or after an early return:

```tsx
function Heading({ children }: { children: ReactNode }) {
  if (!children) return null;
  const theme = use(ThemeContext);
  return <h1 style={{ color: theme.color }}>{children}</h1>;
}
```

## Action state

Use `useActionState` from `react`, in place of `useFormState` from `react-dom`, which React 19 renamed to it.
