# API 响应信封与 Server Action 结果格式

调研日期：2026-10-30。本文比较公开规范、代表性 API 和 Next.js 生态中的响应格式，并结合本项目的 `fetchApi`、`ActionResult` 判断适用范围。资料能够证明这些设计确实存在，不能据此给出采用率排名。

> 调研之后，本项目的 HTTP 格式改成了 [HTTP API 返回格式](../api-response-format.md)。下文提到的本项目 `{ code, data, message }` 信封和 Mock API 行为，是调研时的状态。

## 结论

**业内没有统一的 `{ code, data, message }` 信封，也没有 Next.js 规定的 `ActionResult` 格式。** 常见设计分别依赖 HTTP status、body 中的业务状态、协议定义的 `result/error`，或应用自己的 discriminated union。字段看起来相似，不代表契约相同。

本项目需要分开处理两个问题：对接既有后端时，`fetchApi` 适配后端协议；同一应用的 Server Action 返回什么，由它的 consumer 决定。当前 HTTP 信封与 Action result 不同并非缺陷，没有必要只为了字段一致而统一。

如果未来自建 HTTP API，可优先考虑“成功返回资源或必要的列表容器，失败使用正确 HTTP status + 结构化错误”，需要标准互操作时选择 RFC 9457。内部 Server Action 保持简单的成功/失败 union 就够了；现有 `ok` 判别没有问题。

## 代表性格式

| 格式与一手例证                        | 成功                                                     | 失败                                                                       | 它解决的问题与边界                                             |
| ------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------- |
| HTTP status + 资源对象；Stripe v1     | 单资源直接返回对象；列表使用 `data`、`has_more` 等       | 非 2xx，body 外层 `error`，内部有 `type`、可选 `code`/`param`、`message`   | 成功与失败不必套相同结构；列表容器承担分页职责                 |
| 项目自定义业务信封；本仓库            | `{ code: 0, data, message }`                             | `{ code: 40901, data: null, message }`，可配非 2xx，也可能沿用 200         | 成功值、字段和 HTTP 用法完全由项目定义                         |
| JSend 社区规范                        | `{ status: "success", data }`                            | 预期失败为 `status: "fail"` + `data`；异常为 `status: "error"` + `message` | 明确区分 fail/error；不取代 HTTP status                        |
| RFC 9457 Problem Details              | 不规定                                                   | `type`、`title`、`status`、`detail`、`instance` 与扩展字段                 | HTTP 错误格式标准，不能把它当成完整成功信封                    |
| JSON:API 1.1                          | `data` 中包含规定的 resource object，可有 `links`/`meta` | `errors` 数组；顶层 `data` 与 `errors` 不共存                              | 是包含资源、关系和媒体类型规则的完整 API 规范                  |
| Google API 设计指南                   | Get 返回资源；List 返回命名资源集合和 page token         | HTTP JSON 的外层 `error` 含 `code`、`message`、`status`、`details`         | 区分 HTTP、RPC 状态和细分业务原因，不是本项目的 `code: 0` 约定 |
| JSON-RPC 2.0                          | `{ jsonrpc: "2.0", result, id }`                         | `{ jsonrpc: "2.0", error: { code, message, data? }, id }`                  | `result/error` 互斥，`id` 关联调用；属于 RPC 协议              |
| 应用内部 Result / Server Action union | 如 `{ ok: true, data }`                                  | 如 `{ ok: false, code, params? }`                                          | 应用级结果，字段可自定；不是另一套 HTTP 标准                   |

表中依据：[Stripe errors](https://docs.stripe.com/api/errors)、[Stripe retrieve](https://docs.stripe.com/api/customers/retrieve)、[Stripe pagination](https://docs.stripe.com/api/pagination)、[本项目 fetchApi](../../lib/fetch.ts)、[JSend](https://github.com/omniti-labs/jsend)、[RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html)、[JSON:API 1.1](https://jsonapi.org/format/1.1/)、[Google Get](https://google.aip.dev/131)、[Google List](https://google.aip.dev/132)、[Google errors](https://google.aip.dev/193)、[JSON-RPC response](https://www.jsonrpc.org/specification#response_object)、[Next.js expected errors](https://nextjs.org/docs/app/getting-started/error-handling#handling-expected-errors)。

同样叫 `code`，含义可能不同：JSON:API 的 `error.code` 是字符串业务码，`error.status` 是字符串形式的 HTTP status；Google HTTP JSON 的 `error.code` 是 HTTP 数字，`error.status` 是 RPC 状态名称，而 proto `google.rpc.Status.code` 本身是 RPC enum 数字；JSON-RPC 的整数 `error.code` 又有协议保留区间。因此不能只看字段名写通用解包器。[JSON:API errors](https://jsonapi.org/format/1.1/#error-objects)、[Google HTTP representation](https://google.aip.dev/193#http11json-representation)、[JSON-RPC error object](https://www.jsonrpc.org/specification#error_object)

### 例子一：成功资源与失败对象使用不同结构

以下是说明这种风格的自定义示例，不是 Stripe 的实际 task endpoint：

```http
HTTP/1.1 200 OK
Content-Type: application/json

{ "id": "task_1", "name": "Build" }
```

```http
HTTP/1.1 409 Conflict
Content-Type: application/json

{ "error": { "code": "TASK_NAME_TAKEN", "message": "Choose another name." } }
```

这个设计不需要成功时的 `success: true`、`code: 0` 或 `message: "ok"`。是否增加 `{ data, meta }` 取决于分页、聚合等需求；单个资源和列表也可以有不同结构。Stripe 和 Google 的成功返回方式都是这类设计的实际例证，而不是要求所有 endpoint 必须有同一外壳。

### 例子二：当前项目的业务信封

当前 Mock API 的成功与业务失败都可能使用 HTTP 200：

```json
{ "code": 0, "data": { "id": "task_1", "name": "Build" }, "message": "ok" }
```

```json
{ "code": 40901, "data": null, "message": "名称已存在" }
```

项目的客户端同时检查 HTTP status 和 `code`，因此能识别第二个响应。404、5xx 等仍可使用相应 HTTP status；具体生成逻辑在 [Mock API envelope](../../scripts/mock-api/envelope.mjs)。这种约定可以工作，但 `0`、`40901` 和固定字段并非通用标准。

### 例子三：用标准格式表达 HTTP 错误

```http
HTTP/1.1 409 Conflict
Content-Type: application/problem+json

{
  "type": "https://api.example.com/problems/task-name-taken",
  "title": "Task name is unavailable",
  "status": 409,
  "code": "TASK_NAME_TAKEN"
}
```

这里的 `type` 是稳定的机器标识；`code` 是此示例自行定义的扩展，不是 RFC 必填字段。`detail` 可以解释具体发生了什么，`instance` 可以标识这一次问题。若 body 写 `status`，响应生成方必须让它与实际 HTTP status 一致。字段错误数组及其内部 `path/code/params` 也需要另外定义，RFC 没有统一这些名称。[RFC 9457 §3](https://www.rfc-editor.org/rfc/rfc9457.html#section-3)

采用 Problem Details 不要求成功响应也包一层 `data`，更不需要成功时返回 `type: "success"`。

## HTTP API 与 Server Action 为什么不必同形

| 比较点   | 自建或外部 HTTP API                                                | Server Action 的应用返回值                                     |
| -------- | ------------------------------------------------------------------ | -------------------------------------------------------------- |
| 传输协议 | endpoint 自己定义 status、headers、body，可能有多种语言的 consumer | Next.js/React 管理调用与序列化，应用定义可序列化返回值         |
| 失败表达 | HTTP status 给通用语义，body 描述原因；需兼容非 JSON 的网关错误    | 已知失败可以正常 return；未知异常继续 throw/reject             |
| 格式来源 | 后端契约、公开规范或 API 设计指南                                  | 本项目或所用 Action 库；Next.js 不规定 `ok/success/error` 字段 |
| consumer | `fetchApi`、SDK、其他服务等                                        | `useActionState`、直接调用者、React Query adapter 等           |
| 复用范围 | 公开 API 需要长期兼容与协议文档                                    | 同一应用的操作结果可以按流程定型，但跨边界仍需安全、可序列化   |

Next.js 官方建议预期失败用返回值建模，并展示 `{ message }` 等例子；React 限定可序列化类型，未规定结果对象必须叫什么。因此下面两种风格都合理，区别主要在错误字段是否需要集中组织。[Next.js Error Handling](https://nextjs.org/docs/app/getting-started/error-handling#server-functions)、[React serialization](https://react.dev/reference/rsc/use-server#serializable-arguments-and-return-values)

```ts
type FlatResult<T> =
  { ok: true; data: T } | { ok: false; code: number; message?: string };

type NestedResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: number; message?: string } };
```

这只是比较格式。当前 [ActionResult](../../features/demo-task/types/action-result.ts) 采用 flat，并要求 `message: string`；若以后增加字段错误、参数或关联信息，nested 可能更便于组织，但没有必要仅为了“更标准”迁移。`ok` 换成 `success` 也不会改变机制。

已有库提供的是另一种有效选择。next-safe-action 使用 `data`、`validationErrors`、`serverError` 互斥分支，还包含空结果分支；void 成功也会返回 `{}`，因此不能用 `if (result.data)` 判断所有成功。tRPC 则有自己的 `result.data` 和 `error` 传输结构。这些应由对应库处理，不应只复制几个字段到原生 Action 就宣称采用了相同协议。[next-safe-action result](https://next-safe-action.dev/docs/concepts/action-result)、[tRPC RPC specification](https://trpc.io/docs/rpc)

### 本项目实际经过了三次解释

```text
后端 HTTP status + { code, data, message }
  → fetchApi：成功返回 data，失败抛 ApiError
  → Server Action：已知业务失败转换为 ActionResult，未知异常继续抛出
  → mutationFn：成功返回 data，失败结果转换为本地 Error / rejected Promise
```

最后一步仍然必要：React Query 根据 Promise resolve/reject 判断成功或失败，不理解 `{ ok: false }` 或 `{ code: 40901 }`。直接 return 这类失败对象会走成功状态，可能错误执行 invalidate、关闭表单等 `onSuccess` 行为。当前 [unwrapActionResult](../../features/demo-task/utils/task-action-error.ts) 就承担这个转换；next-safe-action 的官方 TanStack adapter 也采用相同思路，将失败结果转为本地 `ActionMutationError`。[next-safe-action TanStack integration](https://next-safe-action.dev/docs/integrations/tanstack-query)

已知业务失败作为 Action 返回值，与 HTTP API 应合理使用 status 并不冲突：Action consumer 读取的是应用返回结果，而不是自行定义的 REST response。不要依靠 Next.js 内部请求的 HTTP status 推断业务成功，也不要用 thrown server error 的原型或自定义字段作为结果协议；生产环境还会隐藏原始服务端错误消息。[Next.js error reference](https://nextjs.org/docs/app/api-reference/file-conventions/error#error)

## status、code 和 message 各自负责什么

1. **HTTP status** 描述通用请求结果，让通用客户端和中间设施理解成功、认证、冲突、限流或服务器失败。新设计的普通 HTTP API 优先保留这些语义；已有“200 + 业务 code”契约则应兼容，不能由前端擅自修改。[RFC 9110 status codes](https://www.rfc-editor.org/rfc/rfc9110.html#section-15)
2. **机器错误标识** 区分客户端需要不同处理的情况。既可以是本项目的数字 `40901`，也可以是字符串 `TASK_NAME_TAKEN`、Problem Details 的 `type` URI，或 Google 的 `ErrorInfo.reason + domain`。已有 numeric code 没必要为了多语言重编号；新项目可按可读性和已有后端约定选择。[Google ErrorInfo](https://google.aip.dev/193#errorinfo)
3. **message/title/detail** 供人阅读，具体面向开发者还是最终用户取决于协议，不能仅按名字决定直接展示。Google 的 `Status.message` 面向开发者；Stripe 只对特定 card error 明确说明可展示给用户。也不能从文案字符串反推出业务分支。[Google Status.message](https://google.aip.dev/193#statusmessage)、[Stripe errors](https://docs.stripe.com/api/errors)
4. **字段错误与参数** 帮助定位和恢复，如字段 path、长度限制、额度。采用现有协议时遵守其结构；自定义时选择稳定且安全的最小信息，不传 raw exception、stack 或完整用户输入。[Google error detail types](https://github.com/googleapis/googleapis/blob/master/google/rpc/error_details.proto)
5. **requestId/instance 等关联信息** 用来定位某次失败，不能代替业务 code，也不需要为每个成功响应强加一个字段。

全都返回 HTTP 200 会让仅观察 status 的监控难以识别应用失败；这是本项目不建议在全新普通 HTTP API 中默认复制该约定的理由。另一方面，HTTP 5xx、429 或任何 body code 也不自动意味着可以重试，尤其写操作还取决于幂等性和具体失败原因。

## 为多语言保留什么

优先保持业务标识与参数的语言无关性。例如错误原因是 `40901`，UI 根据当前 locale 映射到名称冲突文案；最大长度是 `500`，就传数值而不是只传“最多 500 个字”。`message` 可以作为有明确契约的安全 fallback，不能成为唯一机器标识。

RFC 9457 允许通过 `Accept-Language` 协商 `title/detail` 的语言；Google 分别提供开发者 `message`、机器 `ErrorInfo` 与带 locale 的 `LocalizedMessage`。这说明服务端返回译文与客户端翻译都可以成立，关键是保留稳定信息，并明确译文的使用方。[RFC 9457 §1、§3.1](https://www.rfc-editor.org/rfc/rfc9457.html#section-1)、[Google LocalizedMessage](https://google.aip.dev/193#including-localizedmessage)

对本项目，未来更适合在 query cache、Action state 中保留 code/params，在 UI render 时按当前语言生成字段错误和 inline 文案。已经传给 toast 的字符串不会因此自动更新，仍需要可翻译的内容组件，或切语言时更新/关闭 toast 的策略。字段错误的具体形状、locale 切换和 provider 处理见 [已有错误处理研究](next-react-query-error-handling.md#多语言稳定错误数据与当前文案分离)。不需要在这份协议里加入 `suppressErrorToast`、翻译函数或前端组件名。

## 对本项目的条件化建议

| 实际情况                               | 建议                                                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 对接现成后端                           | 接受其格式，只在 transport adapter 解释 HTTP 和 body；保留 frontend 需要的安全机器信息                        |
| 从零设计普通 HTTP API                  | 成功直接返回资源或有明确用途的列表容器；失败用合理 HTTP status + 结构化错误；需要通用标准时选 Problem Details |
| 同一应用的原生 Server Action           | 保持简单、互斥、可序列化的结果分支；当前 flat `ok` 格式可继续用，未知异常另走异常路径                         |
| 已决定采用 JSON:API、JSON-RPC、tRPC 等 | 使用其完整契约与对应 client；不要只借字段名混进另一套协议                                                     |
| 只是准备多语言                         | 优先分离稳定 code/params 与文案；不必因此更换信封、Action 库或 numeric code                                   |

当前 [setup-data-access](../../.agents/skills/setup-data-access/SKILL.md) 已支持另一种 envelope 或 plain JSON，说明 `{ code, data, message }` 本来就是可适配的模板起点。现在没有后端协议变化的要求，因此本次不建议为了追随某个例子立即改格式。

如果之后确实迁移 HTTP 格式，需要一起核对 `envelopeSchema`、成功值、`ApiError` 的 code 提取、响应 schema 校验位置、retry 条件、[Mock API envelope](../../scripts/mock-api/envelope.mjs)、demo 的业务 code 判断及 transport tests。当前 `fetchApi` 对非空成功响应强制要求现有信封，不能直接接受裸资源、JSON:API 或 `{ success: true }`；非 2xx 的非 JSON 网关响应则应继续被当作请求失败处理。

格式迁移的验证至少包括：正常数据、空响应、业务失败、未知错误码、非 JSON 网关失败、错误 schema、Action 失败不触发 `onSuccess`，以及切换 locale 后错误文案的行为。研究本身只新增此文档，没有变更运行时协议。
