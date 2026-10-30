# HTTP API 返回格式

本文分两层：

- **前端契约**：`fetchApi` 和 `pageSchema` 交给 feature 代码的结果。不管后端用什么格式，这一层都成立，feature 代码只面对它。
- **推荐 wire format**：自建后端和 Mock API 遵循的响应格式。后端符合它时，`lib/` 里的 adapter 只做校验，不用转换；不符合时，在 adapter 里转成前端契约。

wire format 借鉴 Stripe 的[资源响应](https://docs.stripe.com/api/customers/retrieve)和[错误对象](https://docs.stripe.com/api/errors)，列表和分页字段是本项目自己的约定。

## 前端契约

### 成功

`fetchApi` 返回响应体经 `schema` 校验后的输出。空响应体（包括 `204 No Content`）按 `null` 校验。

### 列表

页码分页的响应用 `lib/fetch.ts` 的 `pageSchema(itemSchema)` 校验，得到的字段和下文 wire format 的页码分页相同：`items`、`total`、`hasMore`、`page`、`pageSize`。

游标分页目前没有接口使用，第一个接口出现时在 `lib/fetch.ts` 加对应的 schema，输出 `{ items, hasMore, nextCursor, total? }`。不分页的列表由各接口的 schema 取出 `items` 数组。

### 错误

| 情况                                   | 结果                                         |
| -------------------------------------- | -------------------------------------------- |
| HTTP 非 2xx                            | 抛 `ApiError`                                |
| 2xx，但响应体只有 `error` 一个字段     | 抛 `ApiError`，`status` 是 2xx               |
| 2xx，响应体不符合 `schema`             | 抛 `SchemaValidationError`，前后端契约不一致 |
| 网络错误、调用方通过 `signal` 中止     | 原样抛出                                     |

2xx 时只认只有 `error` 一个字段的响应体：资源自己也可能有 `error` 字段，比如失败任务记录的失败原因，这样的响应照常按 `schema` 校验。

`ApiError` 的字段：

- `status`：HTTP status，总是有值。判断未登录、限流、服务不可用这类通用失败用它。
- `code`：业务错误码，只有响应体符合错误格式时才有。网关、代理、限流返回的错误通常不带业务码，所以它可能是 `undefined`。
- `param`：错误关联的字段名，可能是 `undefined`。
- `params`：翻译文案需要的插值数据，可能是 `undefined`。
- `body`：解析后的原始响应体，不是 JSON 时是文本，用于排查问题。
- `message`：`Error.message`，由 URL、status、`code` 和后端的 `message` 拼成，面向开发者和日志。UI 不直接展示它，而是按 `code` 和 `params` 生成当前语言的文案。

`shouldRetryRequest` 只看 status：5xx 和网络错误最多重试 3 次；4xx、2xx 上的 `error` 和 `SchemaValidationError` 重试也不会成功，不重试。

### 后端格式不同时

在 adapter 里转换，feature 代码不感知：

- 成功响应带信封，比如 `{ code, data, message }`：在 `fetchApi` 里解开信封；2xx 上的失败 `code` 也在这里转成 `ApiError`。
- 错误体是别的结构：改 `lib/fetch.ts` 的 `errorSchema`，把它映射到 `ApiError` 的字段。
- 错误码是字符串：`ApiError.code` 的类型跟着改成 `string`。不要在 `lib/` 里维护一张码表把字符串映射成数字：码表是业务知识，`lib/` 不该依赖它。
- 列表或分页字段不同：分页列表改 `pageSchema`，不分页的列表改各接口的 schema。
- 资源字段的命名（比如 snake_case 转 camelCase）在各接口自己的 schema 里转换，不在 `fetchApi` 里全局转换：`fetchApi` 分不清哪些 key 是字段名，哪些是用户数据，比如以 id 为 key 的 map。

`setup-data-access` skill 负责这些改动，并让 Mock API 返回同样的格式。

## 推荐 wire format

### 普通成功

使用合适的 2xx status。有返回内容时直接返回资源：

```json
{ "id": "task_1", "name": "Build" }
```

没有返回内容时使用 `204 No Content`，响应体为空。

### 列表

列表的数组放在 `items` 里。不叫 `data`，是为了避开 React Query 的 `data`：否则前端会写成 `query.data.data`、`lastPage.data`。

不分页的列表也包一层对象，不返回顶层数组，以后加分页字段时不破坏兼容：

```json
{ "items": [{ "id": "task_1", "name": "Build" }] }
```

两种分页都返回以下字段：

| 字段      | 含义                               |
| --------- | ---------------------------------- |
| `items`   | 当前页的资源数组                   |
| `hasMore` | 是否还有下一页；最后一页为 `false` |

没有匹配记录时，`items` 为 `[]`，`hasMore` 为 `false`。

#### 页码分页

```json
{
  "items": [
    { "id": "task_3", "name": "Deploy" },
    { "id": "task_4", "name": "Review" }
  ],
  "total": 5,
  "hasMore": true,
  "page": 2,
  "pageSize": 2
}
```

额外返回：

- `total`：当前筛选条件下的总记录数，与当前页码无关。
- `page`：当前页码，从 1 开始。
- `pageSize`：每页最多返回的记录数。

#### 游标分页

```json
{
  "items": [
    { "id": "task_1", "name": "Build" },
    { "id": "task_2", "name": "Test" }
  ],
  "hasMore": true,
  "nextCursor": "eyJpZCI6InRhc2tfMiJ9"
}
```

- `nextCursor`：请求下一页时原样传回的不透明字符串。最后一页为 `null`。客户端不解析它，排序方式改变时后端可以换游标的编码。
- `total`：可选。按筛选条件计数在大表上开销很大，Stripe 的列表默认也不返回总数。页面确实需要时再返回，含义与页码分页相同。

### 错误

失败使用合适的 4xx 或 5xx status，响应体统一为 `error` 对象。例如名称冲突：

```http
HTTP/1.1 409 Conflict
Content-Type: application/json

{
  "error": {
    "code": 40901,
    "message": "A task with this name already exists.",
    "param": "name"
  }
}
```

- `code`：必填，稳定的数字业务错误码，用于程序判断和多语言映射。
- `message`：必填，面向开发者的错误说明。前端不直接展示给用户。
- `param`：可选，错误关联的字段名，例如 `name`。一次只报一个字段：表单校验先在浏览器和 Server Action 里用同一个 zod schema 完成，后端报的是名称冲突这类单字段的业务冲突。需要一次报多个字段时再扩展这个格式。
- `params`：可选，翻译所需的插值数据，值为字符串或数字，例如 `{ "max": 100 }`。

后端只能用 2xx 表示失败时（比如旧接口），响应体同样只放 `error` 对象，前端按失败处理。新接口不要这么做：只看 status 的监控、网关和缓存会把它当成成功。
