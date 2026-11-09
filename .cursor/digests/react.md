---
source: .claude/rules/react.md
source-sha256: 1aef7f88e7c3e1d5e2037b2e32a44915ab5300ad1ae2fb69906099089615eebd
---

- New code adds no `useMemo`, `useCallback` or `memo`: React Compiler (`reactCompiler`) memoizes.
- Existing ones stay: removing one can change what the compiler memoizes.
- Disabling a `react-hooks` lint rule needs a real reason: the compiler skips a component that breaks the Rules of React, leaving it unmemoized.
- A wrapper whose props extend the underlying component's passes `ref` on through the spread.
- A ref callback's teardown lives in the function it returns, never in a `node === null` branch: React calls that on detach and skips the `null` call.
