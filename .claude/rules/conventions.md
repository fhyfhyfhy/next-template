# Conventions

## TypeScript

- 不要用 `@ts-ignore`、`@ts-expect-error`、`any`，除非有文档化的技术原因
- Prefer `interface` over `type` for object shapes
- 用 union type，不用 `enum`：`type Status = "idle" | "loading" | "error"` 而非 `enum Status { ... }`
- 尽量不用 `as` 类型断言和 `!` 非空断言 — 优先用 type guard 或 optional chaining

## File Naming

所有文件和目录用 **kebab-case**：`get-task.ts`、`use-delete-scene.ts`、`task-card.tsx`

## Test and lint tooling

- When adding tests, reuse the existing test entry and select scope through runner arguments. Add a separate entry only when execution setup differs, such as browser tests requiring a server.
- When adding source checks, extend the existing linter through configuration, plugins, or local rules. Use a standalone checker only when the linter cannot support the required inputs or execution, and document that limitation.

## Import Paths

- 同一 feature 内必须用相对路径，包括跨子目录：`import { getTask } from "../api/get-task"`。内部实现直接引用所需模块，不回引自身 feature 的根入口或子入口；跨组件目录仍需经过该组件的入口。
- feature 引用外部项目代码必须用 `@/`；从外部引用 feature 也必须用 `@/` 并经过公共入口（见 [Feature public API](architecture.md#feature-public-api)）。
- 同一组件目录内部必须用相对路径；根 `components/`、`components/ui/` 及 `app/` 下的组件目录同样适用（见 [Component directories](architecture.md#component-directories)）。
- 其余项目代码：同目录或子目录用相对路径 `./`，跨目录用 `@/` 别名。
- 第三方包使用包名：`import { useState } from "react"`。

## Third-Party Libraries

| 用途    | 用这个                                                                  | 不要用                                                      |
| ------- | ----------------------------------------------------------------------- | ----------------------------------------------------------- |
| 图标    | `@tabler/icons-react`                                                   | lucide、heroicons、自定义 svg 组件                          |
| 日期    | 优先原生 API（`Intl.DateTimeFormat`、`Date`），原生处理不了时用 `dayjs` | moment、date-fns                                            |
| 表单    | `react-hook-form`                                                       | formik                                                      |
| ID 生成 | `nanoid`                                                                | `uuid`、`ulid`、`crypto.randomUUID()`、`Math.random()` 拼接 |

## 数据请求

一律使用公共封装 `@/lib/react-query` + `fetchApi`（`@/lib/fetch`），禁止 raw `fetch()` / axios / SWR。

写 `**/api/**` 下的文件前先读 `.claude/rules/data-fetching.md`——queryOptions 三层结构、query hook 的 `select` 泛型、mutation 的解构与展开顺序都是强制格式，凭印象写必错。
