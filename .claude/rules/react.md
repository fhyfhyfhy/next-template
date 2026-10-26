---
paths:
  - "**/*.tsx"
  - "**/*.ts"
---

# React 19

仓库已经在 React 19 上,新代码一律按 React 19 写法。看到旧版习惯就改,不留 forwardRef / `Context.Provider` 这类已经被官方标记 deprecated 的 API。

如果对某个 API 拿不准,翻 https://react.dev/blog/2024/12/05/react-19 或 https://react.dev/reference/react, **不要靠记忆里的 React 17/18 写法补代码**——那会引入回退式代码,review 还得回头拆。

## ref:用 prop,不要 forwardRef

React 19 起 `ref` 是普通 prop,组件直接从 props 解构就行。`forwardRef` 已 deprecated,会在后续版本移除。

```tsx
// RIGHT
interface MyInputProps {
  placeholder?: string;
  ref?: Ref<HTMLInputElement>;
}

export function MyInput({ placeholder, ref }: MyInputProps) {
  return <input placeholder={placeholder} ref={ref} />;
}

// WRONG — forwardRef 已废
import { forwardRef } from "react";
export const MyInput = forwardRef<HTMLInputElement, MyInputProps>(
  function MyInput({ placeholder }, ref) {
    return <input placeholder={placeholder} ref={ref} />;
  }
);
```

需要暴露命令式 handle 时,`useImperativeHandle(ref, ...)` 用法不变,只是 `ref` 来源从 forwardRef 第二参数变成 props 字段:

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

消费方写法不变:`<Composer ref={composerRef} />`。

## ref callback 可以返回 cleanup

```tsx
<div
  ref={(node) => {
    if (!node) return;
    const observer = new ResizeObserver(/* ... */);
    observer.observe(node);
    // 返回 cleanup,unmount 时 React 会调
    return () => observer.disconnect();
  }}
/>
```

返回了 cleanup,React 就不再用 `null` 调一次 callback,所以不要再写 `if (node === null) { ... }` 这种旧 pattern。

## Context:`<Context value=...>`,不要 `.Provider`

```tsx
// RIGHT
const ThemeContext = createContext<Theme>(defaultTheme);

<ThemeContext value={theme}>{children}</ThemeContext>;

// WRONG — .Provider 已 deprecated
<ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
```

读 context 优先 `use(Context)` 而不是 `useContext(Context)`,因为 `use` 可以在条件分支 / 早 return 之后调:

```tsx
function Heading({ children }: { children: ReactNode }) {
  if (!children) return null;
  const theme = use(ThemeContext); // 可以在 early return 之后,useContext 不行
  return <h1 style={{ color: theme.color }}>{children}</h1>;
}
```

`use()` 还能直接 unwrap promise(配合 Suspense),省掉手写 loading 分支。

## 还在用旧 API 怎么办

- 看到 `forwardRef` / `Context.Provider` / `useFormState` 等 deprecated API,改写成新 pattern 顺手做掉(在自己改的文件内)。
- Validate changes with the project's lint and TypeScript checks, using its `package.json` and `tsconfig.json` to determine the commands.

## Refs

- React 19 release notes: https://react.dev/blog/2024/12/05/react-19
- React reference: https://react.dev/reference/react
- 拿不准就读文档,**不要凭印象写**。
