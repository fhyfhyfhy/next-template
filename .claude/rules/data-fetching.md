---
paths:
  - "**/api/**"
---

# Data Fetching

## Library: React Query + fetchApi

- 新代码一律使用 React Query + `fetchApi`（from `@/lib/fetch`）
- React Query 从公共封装 `@/lib/react-query` 引入。只有 `lib/react-query` 和 `lib/react-query.client` 对应的封装文件可直接依赖 `@tanstack/react-query` 或私有 client；其他 `lib` 文件也遵守此边界。该限制覆盖导入、转导出、类型引用和动态加载，与路径写法及 JS/TS 扩展名无关。
- 禁止使用 raw `fetch()`、axios、SWR

Excuse: "This is a one-off call, fetchApi is overkill" — Reality: fetchApi handles auth tokens, 401 retry, and error typing. Raw fetch breaks all three.

## 文件组织：一个接口一个文件

`features/{name}/api/` 下一个接口一个文件，命名 `<动词>-<资源>.ts`，动词对齐 HTTP 语义：

| HTTP 方法   | 前缀      | 例子                                     |
| ----------- | --------- | ---------------------------------------- |
| GET         | `get-`    | `get-task.ts`；列表用复数 `get-tasks.ts` |
| POST        | `create-` | `create-scene.ts`                        |
| PUT / PATCH | `update-` | `update-workflow.ts`                     |
| DELETE      | `delete-` | `delete-chat.ts`                         |

- PUT 和 PATCH 统一用 `update-`，不区分全量/部分更新。
- 非 CRUD 的动作接口用业务动词：`cancel-chat.ts`、`send-message.ts`、`upsert-evaluation.ts`。
- **不要把同一资源的多个接口聚合进一个 `<resource>.ts`**（比如 GET + PUT 写在一个 `user-preferences.ts` 里）。
- 多个接口共享的 schema / 类型：优先与拥有它们的接口或模块同置，例如 GET 响应的 schema 留在对应的 `get-*.ts`，兄弟文件通过相对路径复用。形成独立业务契约，或 `utils/` 等下层也需要使用时，提取到所属 feature 的 `types/`，保持 schema 与派生类型同源，并遵守依赖方向（`utils/` 不能反向引用 `api/`）。具体归属见 [Shared code ownership](architecture.md#shared-code-ownership)。
- contract test 是唯一按资源聚合的文件：一个 `<resource>.live.test.ts` 覆盖该资源的增改查删链（见 Contract test 节）。

Why: 一文件一接口让 schema + queryOptions + hook 的三层结构在文件内一眼可见，review 和 diff 都按接口粒度走；聚合文件会随接口数量膨胀，schema、hook、工厂混在一起越来越难拆。

## URL 约定

`url` 只写 host 之后的路径，如 `/v2/chats`；host 来自 `NEXT_PUBLIC_API_HOST`，由 fetchApi 拼接。允许的路径前缀以 `lib/fetch.ts` 里 `ApiPrefix` 的定义为准。

- 用 fetchEventSource 等不走 fetchApi 的请求，自己拼 URL 时用 `${process.env.NEXT_PUBLIC_API_HOST}/v2/...`，host 里已有的部分不要重复。

```ts
// RIGHT
await fetchApi({ url: "/v2/chats" });
await fetchEventSource(`${process.env.NEXT_PUBLIC_API_HOST}/v2/chats/${id}/messages`, ...);

// WRONG
await fetchApi({ url: `${process.env.NEXT_PUBLIC_API_HOST}/v2/chats` }); // TS 报错（ApiPath 不接受）
```

## fetchApi 配置

关键字段(全部见 `lib/fetch.ts` 的 `FetchApiConfig`):

- `params` — query 参数对象,自动序列化拼到 url 后
- `data` — 请求体对象,非 GET 自动 `JSON.stringify` + 加 `Content-Type`
- `schema` — zod schema,2xx 响应自动校验
- `paramsSerializer` — `query-string` 的 `StringifyOptions`,需要换数组格式时用

### Query 走 `params`,不要手拼 URL

GET 的 query 一律传 `params`,fetchApi 内部用 `query-string` 序列化(`undefined` 丢弃、特殊字符 encode 都自带)。不要 `?k=${v}` 手拼,也别用 `URLSearchParams`。

```ts
// RIGHT
await fetchApi({
  url: "/v1/projects",
  params: { pageNum: 1, pageSize: 100, status }, // status 是 undefined 会被丢
});

// RIGHT — 数组换格式
await fetchApi({
  url: "/v1/tasks",
  params: { ids: ["a", "b"] },
  paramsSerializer: { arrayFormat: "comma" }, // ?ids=a,b
});

// WRONG — 手拼,跳过序列化
await fetchApi({ url: `/v1/projects?status=${status}` });
await fetchApi({ url: `/v2/tasks/${id}?include=labels` }); // 路径用模板字符串 ok,query 必须走 params
```

### Body 走 `data`,不要手动 stringify

plain object → fetchApi 自动 stringify + 加 JSON header;`FormData` / `Blob` 原样传,header 留给浏览器。不要用 `body` 字段(会被透给原生 fetch,绕过所有逻辑)。

```ts
// RIGHT
await fetchApi({ url: "/v2/chats", method: "POST", data: { title } });
await fetchApi({ url: "/v2/uploads", method: "POST", data: formData });

// WRONG
await fetchApi({ url: "/v2/chats", method: "POST", data: JSON.stringify({...}) });
await fetchApi({ url: "/v2/chats", method: "POST", body: "..." });
```

### 不要自己加 `Authorization`

fetchApi 默认带 token,特殊场景用 `needsToken: false` 关掉。手写 `headers: { Authorization: ... }` 会和内部逻辑双写,token 刷新后不同步。

## 字段命名: 入参/返回值一律 camelCase

api 函数对外的入参和返回值一律 camelCase(`projectId` 不是 `project_id`),hook / store / 组件只见 camelCase。后端 wire 用 snake_case 时,**在 api 函数这层转**,不要把 snake_case 泄到上层。

- **返回值**:schema 按 wire 形状写(snake_case),`.transform()` 转成 camelCase,`z.infer` 派生的类型自然是 camelCase。
- **入参**:函数签名收 camelCase,传 `params` / `data` 时再映射成 wire 字段名。

```ts
// RIGHT — schema 兜 wire 形状,transform 出口转 camelCase
const projectChatSchema = z
  .object({ project_id: z.string(), created_at: z.number() })
  .transform((v) => ({ projectId: v.project_id, createdAt: v.created_at }));
export type ProjectChat = z.infer<typeof projectChatSchema>; // { projectId, createdAt }

// RIGHT — 入参收 camelCase,调用时映射成 wire 字段名
export const getProjectChats = (projectId: string) =>
  fetchApi({
    url: "/v1/chats",
    params: { project_id: projectId }, // 出口转 snake_case
    schema: apiResponseSchema(projectChatSchema),
  });

// WRONG — schema 不转,snake_case 泄到对外类型,组件里全是 project_id / created_at
const projectChatSchema = z.object({
  project_id: z.string(),
  created_at: z.number(),
});
export type ProjectChat = z.infer<typeof projectChatSchema>; // { project_id, created_at }
```

Why: 转换只在 api 边界做一次,上层全 camelCase,和 TS 生态一致。漏转 wire 命名就会渗透到 hook / 组件 / store,后期想统一得改所有消费点。

## Query 模式: queryOptions 工厂

所有 query 必须使用 `queryOptions()` 工厂函数定义，ESLint `@tanstack/query/prefer-query-options` 规则强制执行。

三层结构（定义在 `features/{name}/api/` 中）：

```ts
import { z } from "zod";
import { fetchApi } from "@/lib/fetch";
import {
  queryOptions,
  useQuery,
  type ApiFnReturnType,
  type QueryConfigWithSelect,
} from "@/lib/react-query";
import { apiResponseSchema } from "@/utils/error";

// 1a. Schema + 类型 — schema 是 source of truth，类型走 z.infer，不再手写 interface
const taskSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["pending", "running", "done", "failed"]),
});
export type Task = z.infer<typeof taskSchema>;

// 1b. API 函数 — fetchApi 自带运行时校验，失败抛 SchemaValidationError 走全局 handler。
//     必须 export：contract test 直接 `await getTask(id)` 跑，比走 renderHook(useTask) 简单一档。
//     feature 对外不 re-export（index.ts 只透出 hook + queryOptions），所以只在 api/ 文件夹内可见。
export const getTask = async (id: string) => {
  const res = await fetchApi({
    url: `/v2/tasks/${id}`,
    schema: apiResponseSchema(taskSchema),
  });
  return res.data.result;
};

// 2. queryOptions 工厂 — 定义 key + fn，可复用于 prefetch / invalidation
export const getTaskQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["task", "detail", id],
    queryFn: () => getTask(id),
  });

// 3. Hook — 必须支持 select：QueryConfigWithSelect + 从 queryConfig 解构出 select
//    单独传给 useQuery，其余 config 再展开。顺序/结构都不能省。
export interface UseTaskOptions<TQueryFnData = unknown, TData = TQueryFnData> {
  id: string;
  queryConfig?: QueryConfigWithSelect<
    typeof getTaskQueryOptions,
    TQueryFnData,
    TData
  >;
}

export const useTask = <TData = ApiFnReturnType<typeof getTask>>({
  id,
  queryConfig: { select, ...queryConfig } = {},
}: UseTaskOptions<ApiFnReturnType<typeof getTask>, TData>) => {
  return useQuery({
    ...getTaskQueryOptions(id),
    select,
    ...queryConfig,
  });
};
```

要点:

- **Schema 是 source of truth**：`z.infer<typeof xxxSchema>` 派生 TS 类型，不再写独立的 `interface` / `type`。
- **`apiResponseSchema(inner)`**（`@/utils/error`）：一行兜住 `{ code, result }` 壳，只写业务 schema。
- **不要再用 `fetchApi<ApiResponse<Foo>>` 泛型**：schema 推断接管类型，显式 generic 删掉。
- **schema 失败自动 graceful**：抛 `SchemaValidationError`，`useRequestError` 有专门分支（开发期 log path + issues，生产期通用 toast）。调用方不要 try-catch。

### ⚠️ 每个 query hook 一定要支持 `select`

**这不是可选的**——所有 `useXxx` query hook 都必须按上面的 3 号结构写，差一处都不行。

缺一不可的四件事：

1. **`<TData = ApiFnReturnType<typeof fn>>` 泛型**：调用方传 `select` 时 `TData` 才能被推断成 select 返回值。
2. **`QueryConfigWithSelect<typeof xxxQueryOptions, TQueryFnData, TData>`**：比 `QueryConfig` 多一个 `select` 字段并正确透传两个泛型，用错类型 select 的返回值就是 `unknown`。
3. **`queryConfig: { select, ...queryConfig } = {}`**：必须把 `select` 单独解构出来。如果直接 `...queryConfig` 整个塞进 `useQuery`，TS 推不出 `TData`，并且 `@tanstack/query/no-unstable-deps` 可能抓不到引用不稳定问题。
4. **`useQuery({ ...queryOptions, select, ...rest })` 的展开顺序**：`queryOptions` 在前（提供 `queryKey` / `queryFn`），`select` 独立传入，`...rest` 在后覆盖其它 config。

```ts
// RIGHT — 调用方可以用 select 派生最小数据，避免无关字段变动触发重渲染
const status = useTask({
  id,
  queryConfig: { select: (task) => task.status },
}).data; // data 的类型是 Task["status"]，不是 Task

// WRONG — 没有 select 支持，只能拿整个对象，只用 status 字段也会被 name/... 任何变更重渲染
const { data: task } = useTask({ id });
const status = task?.status;
```

**为什么强制**：`select` 是 React Query 内建的按字段订阅机制。hook 一开始就把 select 通道搭好，消费方按需派生是零成本的；如果 hook 没开这个口，消费方就只能订阅整条记录，后期要补回来得改所有调用点。加上前三条的泛型/类型推导是环环相扣的：少一环，`select` 的返回类型就会降级到 `unknown`，得靠 `as` 补回来——那就又会触发 lint 的 `@typescript-eslint/consistent-type-assertions`。

## Query Key 规范

结构 `[feature, scope, ...params]`，从通用到具体排列；无限滚动在 `"list"` 后再加 `"infinite"` 子 scope：

```
["task", "detail", id]                // 单个资源
["task", "list", { status, sort }]    // 列表（带筛选）
["task", "list", "infinite", params]  // 无限滚动列表
["scene", "detail", id]
["scene", "list"]
```

一个 feature 里有多个资源时，feature 后面加一层 resource，scope 不变：

```
["agent", "project", "detail", id]                  // agent 下的 project
["agent", "project", "list"]
["agent", "chat", "list", projectId]                // agent 下的 chat，按 project 过滤
["agent", "message", "list", "infinite", chatId]    // agent 下的 message，无限滚动
```

- Feature 名和 resource 名都用单数（`"task"` 不是 `"tasks"`，`"project"` 不是 `"projects"`）
- Scope 用 `"detail"` / `"list"` 区分查询类型；无限滚动不是独立 scope，而是 `"list"` 下的子 scope，这样 `invalidateQueries({ queryKey: ["task", "list"] })` 一次能失效普通列表 + 无限滚动列表
- 筛选/分页参数放对象里（fuzzy matching 友好，`["task", "list"]` 前缀也能匹配到所有筛选条件的列表）
- Key 必须包含 queryFn 依赖的所有变量（ESLint `@tanstack/query/exhaustive-deps` 强制执行）

## Mutation 模式

和 query 同构：上面一个 `export` 的 async 函数，下面一个 `useXxx` hook 包住，两层都 export。hook 外面通过 `mutationConfig?: MutationConfig<typeof fn>` 承接调用方配置。

```ts
import z from "zod";
import { fetchApi } from "@/lib/fetch";
import { MutationConfig, useMutation, useQueryClient } from "@/lib/react-query";
import { apiResponseSchema } from "@/utils/error";

// 1. API 函数 — 和 query 里的 getTask 同构：export 出来，live test 直接 `await deleteComment({...})`
export const deleteComment = async ({ commentId }: { commentId: string }) => {
  const res = await fetchApi({
    url: `/v2/comments/${commentId}`,
    method: "DELETE",
    schema: apiResponseSchema(z.object({})),
  });
  return res.data.result;
};

// 2. Hook — mutationConfig 承接调用方配置
type UseDeleteCommentOptions = {
  discussionId: string;
  mutationConfig?: MutationConfig<typeof deleteComment>;
};

export const useDeleteComment = ({
  discussionId,
  mutationConfig: { onSuccess, ...mutationConfig } = {},
}: UseDeleteCommentOptions) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteComment,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({
        queryKey: getInfiniteCommentsQueryOptions(discussionId).queryKey,
      });
      onSuccess?.(...args);
    },
    ...mutationConfig,
  });
};
```

要点：

- **API 函数独立 export，和 query 的 `getTask` 对称**：live test 直接 `await deleteComment({...})`，不走 `renderHook(useDeleteComment)`。schema 在 fetchApi 里绑好，漂移自动抛 `SchemaValidationError`。
- **`mutationConfig: { onSuccess, ...mutationConfig } = {}` 解构不能省**：
  - 调用方的 `onSuccess` 单独拆出来，和 hook 内置副作用（invalidate 等）组合——内置先跑，用户的后跑；
  - 其它回调（`onError` / `onSettled` / `onMutate` / `retry`）通过 `...mutationConfig` 原样透传。
- **`useMutation({...})` 内部三段展开顺序固定，不能调换**：
  1. `mutationFn` 最前，请求入口一眼可见；
  2. 组合后的 `onSuccess` 第二；
  3. `...mutationConfig` 最后——`onSuccess` 已被解构剥离，不会覆盖第 2 段；`mutationFn` 则由 `MutationConfig` 类型 `Omit` 掉了，调用方传不进来，入口锁死。
- **hook 级外部上下文放在 options 里，不塞进 variables**：`commentId` 这种每次调用都不同的进 fn 参数（`mutate({ commentId })`）；`discussionId` 这种 hook 生命周期内不变、只用来算 invalidation key 的，放进 `UseDeleteCommentOptions` 里。这样 variables 类型就是纯 wire payload，不掺 UI 上下文。
- **Schema 按后端实际形状选**：空响应体用 `z.null()`，空对象 `{}` 用 `z.object({})`，任何漂移都会抛 `SchemaValidationError`，不会静默。
- **invalidation key 从 queryOptions 工厂取**：`getXxxQueryOptions(...).queryKey`，不要字面量硬写 `["xxx", "list"]`（后者和 Query Key 规范脱耦，重构时不报错）。
- **自定义错误文案按 Error Handling 章节的顺序处理**。

### 需要前置确认弹窗时

包装 `mutateAsync` 并同步覆盖 `mutate`，mutation 必须在 `onClose` 内部执行——不能 `await confirm()` 拿返回值之后再 mutate，那样 confirm 的 Promise 会先 resolve，外层 `await mutateAsync()` 拿不到结果：

```ts
const { confirm } = useDialogs();
const _mutateAsync = result.mutateAsync;
result.mutateAsync = async (...args) => {
  let result: Awaited<ReturnType<typeof _mutateAsync>> | null = null;
  const dialogResult = await confirm("确认删除？", {
    confirmButtonType: "destructive-primary",
    onClose: async (isConfirmed) => {
      if (isConfirmed) {
        result = await _mutateAsync(...args); // mutation 在 onClose 中执行，不是 confirm 之后
      }
    },
  });
  return dialogResult ? result : null;
};
result.mutate = (...args) => {
  result.mutateAsync(...args);
};
```

## Error Handling

默认不写错误处理——全局 QueryClient handler 已经把 auth / 超时 / 通用 toast 全包括了。需要改变默认行为时，**query 和 mutation 统一通过 `meta` 字段传 `HandleRequestErrorOptions`**。

全局 handler 在应用层装配：通用协议错误识别、通知机制由基础设施提供；登录弹窗、业务错误策略由所属 feature 提供并注入。全局运行范围不改变代码归属，见 [Shared code ownership](architecture.md#shared-code-ownership)。

### 配置类型：`HandleRequestErrorOptions`

配置类型与拥有该契约的错误处理模块同置。包含登录弹窗等业务选项的契约保留在业务组合层；根目录 hooks 只提供通用通知能力，通过回调接入业务动作。业务组合层使用的配置示例：

```ts
interface HandleRequestErrorOptions {
  suppressErrorToast?: boolean | ((e: unknown) => boolean); // 禁用错误 toast；函数形式按 error 动态决定
  apiCodeMessageMap?: ApiCodeMessageMap; // 局部覆盖单个 ApiCode 的文案
  suppressLoginDialog?: boolean; // 禁用 401 触发的全局登录弹窗
}
```

### Query vs Mutation 的默认值不同

| 场景          | 默认 toast                         | 默认登录弹窗                        |
| ------------- | ---------------------------------- | ----------------------------------- |
| Query 失败    | 不弹（`suppressErrorToast: true`） | 不弹（`suppressLoginDialog: true`） |
| Mutation 失败 | 弹                                 | 弹                                  |

Why：query 是后台自动触发（mount / refetch），toast 弹出来是无上下文的噪声，UI 应由消费方按 `error` 状态渲染空态/错误占位；mutation 是用户主动操作，失败必须有反馈。

### 写法：meta 统一写在 hook 里

query 和 mutation 的 `meta` 都写在 hook 的 `useQuery` / `useMutation` 里，**不要**放到 `queryOptions()` 工厂里。工厂只管 key + fn（纯数据层），错误提示策略属于消费方/UI 层，绑在 hook 上。

**`meta` 必须和 `onSuccess` 一样从 `queryConfig` / `mutationConfig` 里解构出来，再逐字段合进 hook 内置的 meta**。如果只写 `...queryConfig` 让调用方 meta 整体覆盖，调用方只想追加一个 `suppressLoginDialog: true` 就会把 hook 默认的 `suppressErrorToast` 一起抹掉。

```ts
// Query —— 在某条查询上显式启用 toast（例如模型加载失败要提示用户）
export const useTask = <TData = ApiFnReturnType<typeof getTask>>({
  id,
  queryConfig: { select, meta, ...queryConfig } = {},
}: UseTaskOptions<ApiFnReturnType<typeof getTask>, TData>) => {
  return useQuery({
    ...getTaskQueryOptions(id),
    meta: {
      suppressErrorToast: false,
      ...meta, // 调用方的 meta 逐字段覆盖 hook 默认
    } satisfies HandleRequestErrorOptions,
    select,
    ...queryConfig,
  });
};

// Mutation —— 静默失败（例如埋点失败不提示用户）
export const useTrackEvent = ({
  mutationConfig: { onSuccess, meta, ...mutationConfig } = {},
}: UseTrackEventOptions = {}) =>
  useMutation({
    meta: {
      suppressErrorToast: true,
      ...meta,
    } satisfies HandleRequestErrorOptions,
    onSuccess: (...args) => onSuccess?.(...args),
    ...mutationConfig,
    mutationFn: trackEvent,
  });
```

### 自定义错误文案的顺序

碰到后端新的错误码时，先确定归属，再补共享默认文案：

1. **确定归属** → 通用协议错误由根目录错误工具维护；配额、余额等业务错误码和文案保留在所属 feature，即使有多个调用方。
2. **补默认文案** → 在所属模块集中维护错误码与 `codeMessageMap`（走 i18n）。业务映射通过 feature 公共入口提供，由应用层注入全局 handler，或由该 feature 的 query/mutation hook 写入 `meta.apiCodeMessageMap`。
3. **默认文案在当前调用点不合适** → 再用 `meta.apiCodeMessageMap` 局部覆盖。

```ts
// RIGHT — 配额错误的默认文案集中在所属 feature 的错误映射中，所有调用方复用
[ApiCode.QUOTA_EXCEEDED]: t("Error.QuotaExceeded"),

// RIGHT — 同一个 code 在不同业务场景要不同文案时，meta.apiCodeMessageMap 局部覆盖
useMutation({
  meta: {
    apiCodeMessageMap: {
      [ApiCode.INSUFFICIENT_BALANCE]: t("Checkout.InsufficientBalance"),
    },
  } satisfies HandleRequestErrorOptions,
  mutationFn: createOrder,
});

// WRONG — 调用点独自定义业务错误文案，所属 feature 没有共享默认映射
useMutation({
  meta: {
    apiCodeMessageMap: { [ApiCode.QUOTA_EXCEEDED]: "..." },
  },
  mutationFn: createOrder,
});

// WRONG — 绕过 meta 自己处理，全局已经 toast 过一次，组件再 toast 就是双弹
try { await mutateAsync(...); } catch (e) { toast.error(e.message); }
useMutation({ onError: (e) => toast.error(e.message) });
```

Why: 每类错误由所属模块维护一份默认映射，调用方共享语义，应用层负责装配。这样同一个 code 的文案保持一致，也不会把业务规则堆进全局工具目录。
