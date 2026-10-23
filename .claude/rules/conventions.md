# Conventions

## Test and lint tooling

- When adding tests, reuse the existing test entry and select scope through runner arguments. Add a separate entry only when execution setup differs, such as browser tests requiring a server.
- When adding source checks, extend the existing linter through configuration, plugins, or local rules. Use a standalone checker only when the linter cannot support the required inputs or execution, and document that limitation.

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
