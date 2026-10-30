# Next.js + React Query 的错误处理与多语言

调研日期：2026-10-30。对照本项目实际安装的 Next.js 16.4.3、React 19.3.0、TanStack Query 5.104.5、TanStack Form 1.33.5、Zod 4.6.7。项目尚未安装 next-intl；下文把它作为未来多语言方案的参考，不要求现在引入依赖。

本文区分三种依据：**官方契约**决定 API 如何工作；**维护者建议**提供有经验支持的设计选择；**本项目建议**结合现有代码和模板目标作取舍。研究没有修改运行时代码，也不代表下面的建议已经成为规则。

## 结论

`suppressErrorToast` 不是 Next.js 或 React Query 的必要组成。取消它、让各个用户流程负责错误展示，是合理的项目选择。但“现在由 agent 编程，所以全局处理没有必要”不是社区共识：TanStack Query 维护者明确推荐用 cache 层 callback 处理统一错误通知，尤其用于避免多个 query observer 重复弹 toast。[维护者说明](https://tkdodo.eu/blog/breaking-react-querys-api-on-purpose)

本模板更适合采用 **局部展示 + 集中诊断**：query 的展示区域处理加载和刷新失败，用户操作的流程处理 mutation 失败，基础设施保留错误分类、日志、重试和 cache 一致性。这个选择的前提是接受后台失败主要用 inline 状态表达，并为每个重要流程安排实际的反馈入口。若产品仍要求“所有后台失败都弹 toast”，cache 层集中通知更合适，不能用每个组件的 effect 替代。

多语言方面更明确的改进是：**保存稳定的错误信息，展示时生成当前语言的文案**。保留现有数字业务 `code`，按需要补充安全的 `params` 和字段错误描述；不要把后端 `message`、`Error.message` 或已经翻译的字符串当作长期的 UI 状态。[next-intl 作者的错误消息案例](https://next-intl.dev/blog/translations-outside-of-react-components)

## 官方契约：先分清四个边界

### 1. 请求失败与用户文案

React Query 通过 rejected Promise 判定失败。原生 `fetch` 遇到 HTTP 4xx/5xx 不自动 reject，请求层需要检查响应并抛出错误。本项目 [fetchApi](../../lib/fetch.ts) 已区分 HTTP/业务信封错误、响应 schema 错误及原生网络错误，应保留这层能力。[Query Functions](https://tanstack.com/query/latest/docs/framework/react/guides/query-functions#handling-and-throwing-errors)

错误信息的机器判别和用户文案应分开。RFC 9457 也区分机器标识与可本地化的 `title`/`detail`，明确不应解析 `detail` 获取机器信息。这支持保留稳定 `code`，并不意味着本项目必须把现有响应信封改成 Problem Details。[RFC 9457 §3.1、§3.2](https://www.rfc-editor.org/rfc/rfc9457.html#section-3.1)

### 2. Server Action 的结果与异常

预期的 validation 或业务失败应返回可序列化结果；意外异常继续抛出。返回值只包含 UI 需要的安全字段，不能假设自定义 `Error` class、原型和附加字段跨边界后仍可识别。[Next.js Error Handling](https://nextjs.org/docs/app/getting-started/error-handling#handling-expected-errors)、[React Server Function serialization](https://react.dev/reference/rsc/use-server#serializable-arguments-and-return-values)

生产环境会隐藏服务端异常的原始消息，提供通用错误与 `digest` 供日志关联。因此不能用 thrown server error 的 `message` 传业务错误码、翻译 key 或用户文案；开发环境看起来可用并不能证明生产可用。[Next.js 官方安全说明](https://nextjs.org/blog/security-nextjs-server-components-actions#error-handling)

本项目已有 [ActionResult](../../features/demo-task/types/action-result.ts) 和 [unwrapActionResult](../../features/demo-task/utils/task-action-error.ts)。这两个概念仍有价值：直接 Action consumer 分支处理结果；React Query 的 `mutationFn` 将失败结果转成浏览器本地错误，避免 `{ ok: false }` 被当作成功并执行 `onSuccess`。删除 toast 协议不意味着删除这个 adapter。

只转换已知失败，未知异常重新抛出。`redirect()`、`notFound()` 等属于框架控制流，不能被大范围 catch 当成业务失败吞掉；优先收窄 catch 范围。`unstable_rethrow` 仍是 unstable API，不必为了统一错误处理引入它。[Next.js unstable_rethrow](https://nextjs.org/docs/app/api-reference/functions/unstable_rethrow)

### 3. Error boundary 的覆盖范围

`error.tsx` 处理其子树的渲染异常，不包住同一 segment 的 `layout`/`template`。`global-error.tsx` 替换 root layout，必须独立提供 `<html>`、`<body>` 和所需依赖。Next.js 16.4.3 的 `retry()` 会重新请求并渲染；`reset()` 只清除错误并重新渲染。局部恢复可以使用 `catchError`，不必为此另装 boundary 库。[error.js](https://nextjs.org/docs/app/api-reference/file-conventions/error)、[catchError](https://nextjs.org/docs/app/api-reference/functions/catchError)

普通事件 handler 和游离 async task 的异常不会自动进入 boundary。`useTransition` 返回的 `startTransition` 中 throw/reject 是受支持的例外；不要与独立导入的 `startTransition` 混淆。React Query 则可通过 `throwOnError` 把失败带入后续 render。[React useTransition](https://react.dev/reference/react/useTransition#displaying-an-error-to-users-with-an-error-boundary)、[React startTransition](https://react.dev/reference/react/startTransition)、[TanStack Suspense](https://tanstack.com/query/latest/docs/framework/react/guides/suspense)

### 4. 诊断与展示

集中诊断不等于集中弹 toast。Next.js 的 `instrumentation.ts/onRequestError` 可记录框架捕获的 server render、Route Handler、Action 等异常；浏览器请求可在 cache callback 中记录。主动 catch 后变成普通返回值的错误，不会因为存在 instrumentation 就自动被记录。[Next.js instrumentation](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation#onrequesterror-optional)

本项目建议：未知异常和响应 schema 不匹配进入诊断；可预期的字段错误通常不需要作为异常上报。UI 给出安全、可本地化的说明和恢复入口，诊断保留必要的错误类型、业务 code 和关联标识，避免把原始响应及用户输入不加筛选地复制出去。

## 按用户场景选择展示方式

以下是基于框架能力的项目建议，不是库强制的 UI 设计。

| 场景                               | 反馈归属与建议                                                           | 要避免的问题                                              |
| ---------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------- |
| query 首次加载失败，没有可用数据   | 页面或局部数据区域展示错误与重试；Suspense query 交给合适粒度的 boundary | 只有 toast，页面永久空白；一个小区域失败替换整页          |
| query 后台刷新失败，已有数据       | 保留旧数据，由区域显示刷新失败/过期状态；是否额外 toast 由产品决定       | `isError` 分支先返回，隐藏仍可用的数据                    |
| 表单输入错误、名称冲突             | 表单字段或表单级说明，保留用户输入                                       | generic toast 代替可恢复的字段反馈                        |
| 删除、收藏、重试任务等用户操作失败 | 发起操作的流程提供失败反馈，必要时恢复交互状态                           | 移除全局 toast 后只做 rollback，用户不知道操作失败        |
| 预取、轮询等后台工作失败           | 按对当前界面的影响处理；无影响时可只诊断                                 | 每次后台请求失败都打断用户                                |
| 认证失效、权限不足                 | 在会话或对应业务流程明确处理                                             | 将每个 401/403 都机械地当普通 toast；多个请求同时反复导航 |
| 渲染缺陷、未知服务端异常           | 局部/路由 boundary 与诊断                                                | 原样展示 stack、URL 或生产环境的 generic 技术错误         |

`useSuspenseQuery` 默认只在没有缓存数据可展示时把错误交给 boundary，后台失败仍可返回旧数据。恢复 Suspense query 时，需要同时解除 React Query 的错误重试限制和 UI boundary 状态；本项目 [QueryErrorBoundary](../../features/demo-task/components/query-error-boundary.tsx) 先调用 `useQueryErrorResetBoundary().reset()`，再调用 Next.js `retry()` 的方向正确。[TanStack Suspense 与 reset](https://tanstack.com/query/latest/docs/framework/react/guides/suspense#resetting-error-boundaries)

普通 `useQuery` 也应判断数据是否存在，而不是只看 `isError` 或数据的 truthiness：`0`、`false`、空字符串可能是合法数据。后台错误与可用数据可以同时存在。[useQuery API](https://tanstack.com/query/latest/docs/framework/react/reference/useQuery)

## 全局与局部：社区真正支持什么

TkDodo 的两篇文章分别说明了 cache 层通知和 `useQuery` callback 的问题：多个 observer 各自执行副作用会重复提示；统一 toast 放到 `QueryCache`，并通过 `meta` 提供差异信息，是他明确支持的做法。文章部分示例来自旧版本，但 v5 已移除 `useQuery.onError/onSuccess/onSettled`，没有移除 mutation callbacks。[React Query Error Handling](https://tkdodo.eu/blog/react-query-error-handling)、[Breaking React Query's API on purpose](https://tkdodo.eu/blog/breaking-react-querys-api-on-purpose)、[v5 migration](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5#callbacks-on-usequery-and-queryobserver-have-been-removed)

| 方案                           | 适用目标                                              | 必须承担的成本                                                                  |
| ------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------- |
| 全局默认通知，局部例外         | 产品需要统一兜底，后台故障也必须被注意                | 明确局部反馈如何避免重复；控制多 query 同时失败的噪声；多语言需读取当前展示语言 |
| 局部展示，集中诊断             | 各个流程需要有上下文的恢复 UI；模板希望少一些隐式策略 | 给每个重要流程安排反馈入口，验证卸载、连续操作和未知失败                        |
| 仅对明确的后台场景启用集中通知 | 少数后台流程确实需要一次性通知                        | 保持 opt-in 信息简单；不要逐渐长成另一套万能错误策略系统                        |

全局 callback 的“一次”是对应 query 的失败事件，不是应用里所有失败只通知一次。不同 query 同时失败、后续 refetch 再次失败，仍需另定合并策略。现有固定 toast ID 是产品层的去重选择，不是 React Query 自动提供的行为。

**本项目选择建议：第二种。** 先补齐流程反馈，再移除默认业务 toast 和 `suppressErrorToast`。不把它改名为另一套 `errorPolicy` 后继续维持相同复杂度。如果以后出现必须集中通知的具体场景，再采用第三种；保留简单可序列化数据比向 query `meta` 塞 predicate 更适合 hydration。

这里还有一个必须处理的 mutation 生命周期问题：`mutate(variables, { onError })` 中的临时 callback 在组件卸载后不执行；连续调用时，它也不是每次操作都有保证的回调。离开页面后不再提示，有时正是期望行为；需要每笔结果都被处理时，选择 mutation options callback、每次 `mutateAsync` 的 Promise 或持续存在的流程状态。[Mutations：side effects、consecutive mutations、promises](https://tanstack.com/query/latest/docs/framework/react/guides/mutations)、[维护者对 callback 职责的说明](https://tkdodo.eu/blog/mastering-mutations-in-react-query#some-callbacks-might-not-fire)

不能看到局部存在 `onError` 就推断它已经展示错误，从而自动跳过全局通知；它可能只负责 rollback。维护者也明确指出这种启发式的局限。[TanStack Query discussion #6671](https://github.com/TanStack/query/discussions/6671)

因此，“每个请求自己处理”应改成“每个用户流程有明确的反馈归属”。不要在可复用请求函数里 toast，也不要用 call-site callback 覆盖 factory 的 cache 更新、invalidate 或 rollback。用户离开对话框后仍必须报告的操作，由存活更久的页面/流程承接反馈；不是给所有组件加 error effect。

## 多语言：稳定错误数据与当前文案分离

### 建议的最小协议

现有业务 `code: number` 可以继续使用，业务 feature 将已知 code 映射到自己的 message key。未知 code、网络失败及不可展示的异常映射到安全的通用 key。后端不需要知道前端的翻译目录结构。

下面是数据形状示意，不是要求新增一个全局 error framework：

```ts
// 现有业务错误码；不需要为了多语言改成字符串。
const nameTaken = { ok: false, code: 40901 };

// 有动态约束时，传数据而不是拼接后的文案。
const validationFailure = {
  ok: false,
  fieldErrors: [{ path: ["prompt"], code: "maxLength", params: { max: 500 } }],
};
```

UI 映射可表达为：`40901 → Task.errors.nameTaken`，`maxLength + { max } → Validation.maxLength`。每个 feature 按真实错误定义有限的类型和允许的参数；无参数时省略 `params`。不从任意后端字符串动态调用 `t()`，不把 raw body、密码等输入当 interpolation 参数。

同一个失败可以由重命名表单显示在名称字段，也可以由批量操作汇总显示。错误数据描述失败原因，流程决定展示位置和措辞；这正是请求层不需要携带 toast 抑制函数的原因。

### 在哪里翻译

优先在 render 时调用 `useTranslations`，让字段错误、inline 状态和 boundary 文案随 locale 变化。state/cache 中留结构化信息。next-intl 作者直接以错误提示解释了“先翻译再存 state”会留住旧语言的问题。[Formatting during render](https://next-intl.dev/blog/translations-outside-of-react-components#a-better-way-formatting-during-render)

**Server Action 直接返回译文也是有效方案。** next-intl 官方支持在 Action 中用 `getTranslations`；next-safe-action 也支持每次调用时异步创建本地化 schema。它适合生命周期短、切语言会重建/清空表单的流程。若错误留在共享 cache、长寿命组件或 toast 中，则需要重译、重验证或清空策略。本项目偏向 descriptor 是为了应对这些生命周期，并非服务端翻译错误。[next-intl Server Actions](https://next-intl.dev/docs/environments/actions-metadata-route-handlers#server-actions)、[next-safe-action i18n](https://next-safe-action.dev/docs/advanced/i18n)

### Zod 与表单

Zod issue 提供 `code`、`path` 和约束参数，可以在 feature 边界转换为前述字段描述。只保留 UI 需要的字段，不把完整 `ZodError`/issues 当通用跨边界协议；输入校验失败与后端响应 schema 不匹配是两种不同问题。[Zod issues](https://zod.dev/packages/core#issues)

若选择服务器生成译文，用每次 `parse/safeParse` 的 error map，或按本次 locale 创建 schema。不要按请求调用全局 `z.config(locale)`，它会修改共享配置；并发 SSR 请求的语言不应互相影响。schema 内已经写死的 message 优先级高于 per-parse error map，迁移时也要清理这些硬编码。[Zod error customization 与 precedence](https://zod.dev/error-customization)、[next-intl Zod 示例](https://next-intl.dev/docs/environments/actions-metadata-route-handlers#server-actions)

### locale、cache 和 provider

- **query key**：请求结果受 locale 影响时，包括成功数据或服务端返回的错误译文，locale 应进入 query key。只在客户端将同一份错误描述翻译成另一种语言，不需要复制 query cache。这是对“queryFn 使用的变化变量必须进入 key”的应用；语言无关的错误 code 可以避免仅为错误文案区分缓存。[Query Keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys#if-your-query-function-depends-on-a-variable-include-it-in-your-query-key)
- **长期存活的 QueryClient**：不能在第一次创建 browser client 时永久捕获当时的 `t`。若保留集中通知，展示处要使用当前 locale；SSR 的翻译配置按请求获取，不存成跨请求全局 translator。[next-intl request configuration](https://next-intl.dev/docs/usage/configuration)
- **在途操作与 toast**：请求期间切语言，失败完成时应按当时的展示语言处理。已经调用 `toast.error(t(...))` 的字符串不会自动变语言；重建 `<Toaster>` 也不等于清空 Sonner 的模块级状态。可以让 toast 内容由翻译组件渲染，或明确切语言时更新/关闭已有 toast。[Sonner state 源码](https://github.com/emilkowalski/sonner/blob/main/src/state.ts)
- **错误页面**：普通 `error.tsx` 所在 boundary 外需有包含相应 messages 的 `NextIntlClientProvider`。`global-error` 替换 root layout，不能依赖原 provider；未来应提供独立、最小的错误文案和可用的默认语言。[next-intl error files](https://next-intl.dev/docs/environments/error-files)、[Next.js global error](https://nextjs.org/docs/app/api-reference/file-conventions/error#global-error)
- **翻译系统自己的错误**：next-intl 的 `onError/getMessageFallback` 处理缺失或无效翻译，不是业务请求失败 handler；其 fallback 也要能在翻译缺失时显示。[next-intl error handling](https://next-intl.dev/docs/usage/configuration#error-handling)

## 当前项目哪些地方需要调整

下表是后续实施清单，不是本次已完成的变更。

| 位置                                                                                                                                                                                                                                              | 当前行为                                                       | 建议方向                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [app/providers.tsx](../../app/providers.tsx)、[lib/react-query.ts](../../lib/react-query.ts)                                                                                                                                                      | query/mutation 默认通知、`suppressErrorToast` 和通用中文 toast | 若采用局部方案，拆除通知协议，保留必要诊断与独立的 SSR/GC/retry 约定       |
| [lib/fetch.ts](../../lib/fetch.ts)                                                                                                                                                                                                                | `ApiError.message` 包含 URL、status、code 和后端 message       | 留作诊断，不直接作为产品文案；继续提供可判别错误                           |
| [update-task-action](../../features/demo-task/api/update-task-action.ts)、[retry-task-action](../../features/demo-task/api/retry-task-action.ts)、[ActionResult](../../features/demo-task/types/action-result.ts)                                 | 返回业务 code 和固定中文 message                               | 已有 result 机制保留，UI 使用 code 映射当前文案；按真实需求增加安全 params |
| [create-task-action](../../features/demo-task/api/create-task-action.ts)、[create-task](../../features/demo-task/api/create-task.ts)、[get-task](../../features/demo-task/api/get-task.ts)                                                        | 固定中文 Zod message，`flattenError` 后返回字段字符串          | 选择字段 descriptor，或明确使用每请求本地化及切语言重建策略                |
| [QueryErrorBoundary](../../features/demo-task/components/query-error-boundary.tsx)、[task-detail](../../features/demo-task/components/task-detail/index.tsx)、[feed-grid](../../features/demo-task/components/feed-grid/index.tsx)                | 直接展示 `error.message`                                       | 改为安全、可本地化的场景文案；保留诊断关联                                 |
| [task-actions](../../features/demo-task/components/task-detail/task-actions.tsx)、[rename-task-form](../../features/demo-task/components/task-detail/rename-task-form.tsx)                                                                        | 部分业务错误有局部 UI，其余依赖全局 toast                      | 补齐未知错误、网络失败和操作生命周期内的反馈                               |
| [hydration-state](../../features/demo-task/utils/hydration-state.ts)                                                                                                                                                                              | 为 function-valued `meta.suppressErrorToast` 特别过滤          | 协议完全移除后才能删对应过滤，其他 hydration 构造职责保留                  |
| [data-fetching.md](../../.claude/rules/data-fetching.md)、[data-fetching-api.md](../../.claude/rules/data-fetching-api.md)、[next-data-flow](../../.agents/skills/next-data-flow/SKILL.md)、[query-plugin](../../scripts/eslint/query-plugin.mjs) | 文档与 lint 共同约束当前反馈和 factory callback 分工           | 同一次迁移中核对；反馈局部化不能意外覆盖 cache callbacks                   |

还应审视哪些输入失败需要给用户恢复信息：创建 Action 使用 `safeParse` 返回字段错误，而更新/重试 Action 的 `parse` 直接抛错。不能因为两者都使用 Zod 就认为用户体验已一致；也不能把所有响应 schema 异常都转成“输入有误”。

## 推荐实施顺序与验证

1. 先确认模板的反馈约定：query 采用 inline/boundary；用户 mutation 有明确的流程 owner；后台失败不默认要求 toast。否则保留 cache 层通知方案。
2. 先为现有 demo 补齐缺失的失败反馈，再移除 `suppressErrorToast`、默认业务 toast 及专用 hydration 过滤。用 demo 展示 agent 应照抄的行为，skill 说明选择与验证条件。
3. 将业务 code 与用户文案分开，整理已有 `error.message` 直出点和硬编码字段错误。无需为未来所有领域预建统一 `ErrorManager`、错误 catalog 或新的结果库。
4. 接入多语言时再确定 locale routing、provider 和 messages 组织，复用上面的错误数据；服务端 retry、GC、成功失效和 optimistic rollback 不随 UI 文案迁移改变。

| 验证条件                                                                  | 应看到的结果                                                                    |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 首次 query 失败、后台 refetch 失败、两个 observer 订阅同一 query          | 首次有恢复入口；后台保留旧数据；无重复 toast/effect                             |
| 多个 query 同时失败、同一 query 再次失败                                  | 若启用集中通知，合并行为符合约定，不误称 cache callback 已全局去重              |
| mutation 业务失败、网络失败、连续操作、发起组件卸载                       | 每个需要用户知道的操作都有反馈；cache rollback/invalidate 不被 UI callback 覆盖 |
| expected Action failure 与 unexpected exception，在 production build 运行 | 预期 code 可识别；未知异常只给安全 fallback；成功流程不在失败时触发             |
| 已显示字段错误时切语言、请求等待中切语言、toast 显示中切语言              | 文案遵循约定；保留的错误和 QueryClient 不继续固定使用旧语言                     |
| 两个 locale 的并发 SSR 请求、locale-dependent API query                   | 无共享翻译配置串语言；依赖 locale 的数据有正确 cache identity                   |
| 译文缺失、root provider 出错、Suspense query 重试                         | 错误 UI 自身可用；fallback 不循环报错；点击重试确实重新请求                     |
| 表单错误与动态反馈                                                        | 文本说明可定位字段，输入不丢失；屏幕阅读器能感知重要状态                        |

重试是另一条独立策略：query 默认 browser 重试、server 不重试；mutation 默认不重试。项目可以细化瞬时网络/5xx、限流与业务错误的处理，但不能把“显示了错误”理解为“可以安全重复写入”。写操作的自动重试需要考虑幂等性。[Query Retries](https://tanstack.com/query/latest/docs/framework/react/guides/query-retries)、[Mutation retry](https://tanstack.com/query/latest/docs/framework/react/guides/mutations#retry)

可访问性验证的依据是错误需要可识别的文本说明，动态状态需要可被辅助技术感知；不要求所有失败都弹 toast，也不要求所有状态都使用强打断的 alert。[W3C Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html)、[W3C Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)

## 资料的适用范围

本文优先使用官方 API 文档、维护者自己的解释及源码。TkDodo 的文章用于理解设计取舍，旧示例以当前 v5 API 为准；next-intl 的部分 error 示例仍使用 `reset`，本项目恢复 RSC 应采用 Next.js 16.4.3 的 `retry`。next-safe-action 仅作为社区库如何处理 validation/业务错误及 i18n 的一手例证，不建议为这次简化新增依赖。

框架相关结论同时核对了本地 `node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md`、`03-api-reference/03-file-conventions/error.md`、`03-api-reference/04-functions/catchError.md` 和 `03-api-reference/03-file-conventions/instrumentation.md`。研究只验证文档、源码契约与当前代码结构；表中未来方案的浏览器和 production 行为还需在实施时验证。
