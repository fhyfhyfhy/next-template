import queryString, {
  type StringifiableRecord,
  type StringifyOptions,
} from "query-string";
import { z } from "zod";

/** 本 app 的接口路径，同源，比如 `/api/demo/tasks`。 */
export type ApiPath = `/${string}`;

// 失败响应体 `{ error: { code, message, param?, params? } }` 里的错误对象。`message` 面向开发者，
// UI 按 `code` 和 `params` 生成文案。服务端按这个格式写失败响应（lib/domain-error.ts 的 `errorBody`）。
const errorSchema = z.object({
  code: z.number(),
  message: z.string(),
  param: z.string().optional(),
  params: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});
const errorBodySchema = z.object({ error: errorSchema });
// 2xx 只在响应体只有 `error` 一个字段、且它符合 errorSchema 时算失败：资源自己也可能带 `error` 字段
// （比如失败任务记录的原因），那仍是成功响应；`{ error: "boom" }` 这类不合格式的按 schema 校验。
const errorOnlyBodySchema = z.strictObject({ error: errorSchema });

export interface FetchApiConfig<TSchema extends z.ZodType> extends Omit<
  RequestInit,
  "body"
> {
  /** 业务接口路径，不带 query：query 参数放进 `params`。 */
  url: ApiPath;
  /**
   * 响应体必须通过的 schema；空响应体（如 204）按 `null` 校验。成功响应直接是资源本身，
   * 列表把数组放在 `items` 里，页码分页的列表用 `pageSchema`。
   */
  schema: TSchema;
  /** Query 参数，值为 `undefined` 的键不会出现在 URL 中。 */
  params?: StringifiableRecord;
  /** 传给 query-string 的 `stringifyUrl`，比如数组参数的写法；默认 `status=a&status=b`。 */
  paramsSerializer?: StringifyOptions;
  /** 请求体：`FormData`、`Blob` 原样发送，其余值序列化为 JSON。 */
  data?: unknown;
}

interface ApiErrorInit {
  url: ApiPath;
  status: number;
  body: unknown;
}

/**
 * 接口失败：HTTP 非 2xx，或 2xx 但响应体只有符合格式的 `error` 对象（此时 `status` 是 2xx）。
 * `status` 总是有值，判断未登录、限流、服务不可用这类通用失败用它。`code`、`param`、`params` 取自
 * 响应体的 `error` 对象，响应体不是这个格式时（如网关的错误页）都是 `undefined`；`body` 是解析后的
 * 响应体，不是 JSON 时为原始文本。`message` 由 URL、status 和后端的 `error.message` 拼成，面向开发者和
 * 日志，UI 不直接展示它，而是按 `code` 和 `params` 生成文案。
 */
export class ApiError extends Error {
  readonly url: ApiPath;
  readonly status: number;
  /** 业务错误码。 */
  readonly code: number | undefined;
  /** 错误关联的请求字段名。 */
  readonly param: string | undefined;
  /** 翻译文案需要的插值数据。 */
  readonly params: Record<string, string | number> | undefined;
  readonly body: unknown;

  constructor({ url, status, body }: ApiErrorInit) {
    const error = errorBodySchema.safeParse(body).data?.error;
    const detail = error ? `, code ${error.code}: ${error.message}` : "";
    super(`${url} responded with ${status}${detail}`);
    this.name = "ApiError";
    this.url = url;
    this.status = status;
    this.code = error?.code;
    this.param = error?.param;
    this.params = error?.params;
    this.body = body;
  }
}

/** 2xx 的响应体不符合 schema，说明前后端契约已经不一致。 */
export class SchemaValidationError extends Error {
  readonly url: ApiPath;
  readonly issues: z.core.$ZodIssue[];

  constructor(url: ApiPath, error: z.ZodError) {
    super(
      `${url} response does not match its schema:\n${z.prettifyError(error)}`,
    );
    this.name = "SchemaValidationError";
    this.url = url;
    this.issues = error.issues;
  }
}

const MAX_RETRIES = 3;

/**
 * React Query 的 `retry`：4xx、2xx 上的 `error` 和 schema 不匹配重试也不会成功，不重试；其余失败最多重试
 * 3 次，包括 5xx、网络错误，以及 `queryFn` 里抛出的其他异常。
 */
export function shouldRetryRequest(failureCount: number, error: unknown) {
  if (error instanceof SchemaValidationError) return false;
  if (error instanceof ApiError && error.status < 500) return false;
  return failureCount < MAX_RETRIES;
}

/**
 * 浏览器请求本 app 的接口（`/api` 下的 Route Handler），按 `schema` 校验响应体，返回 schema 的输出。
 * 只在浏览器里调用：服务端代码直接调用 feature 的数据层，不请求自己的 Route Handler（.claude/rules/data-layer.md），
 * 在服务端调用时直接抛错。浏览器自己带着同源的 cookie，不另外附加凭证。
 * HTTP 非 2xx 或 2xx 的响应体只有 `error` 对象时抛 `ApiError`，响应体校验失败抛 `SchemaValidationError`；
 * 网络错误和 `signal` 的中止原样抛出。
 */
export async function fetchApi<TSchema extends z.ZodType>({
  url,
  schema,
  params,
  paramsSerializer,
  data,
  headers,
  ...init
}: FetchApiConfig<TSchema>): Promise<z.output<TSchema>> {
  if (typeof window === "undefined") {
    throw new Error(
      `fetchApi(${url}) runs in the browser only; on the server, call the feature's data layer instead`,
    );
  }
  const requestHeaders = new Headers(headers);
  const response = await fetch(
    queryString.stringifyUrl({ url, query: params }, paramsSerializer),
    {
      ...init,
      headers: requestHeaders,
      body: requestBody(data, requestHeaders),
    },
  );
  const body = parseBody(await response.text());
  if (!response.ok || errorOnlyBodySchema.safeParse(body).success) {
    throw new ApiError({ url, status: response.status, body });
  }
  const result = schema.safeParse(body);
  if (!result.success) throw new SchemaValidationError(url, result.error);
  return result.data;
}

/** 页码分页的列表响应，用作 `fetchApi` 的 `schema`：要显示总数、能跳页的列表用它。 */
export function pageSchema<TItem extends z.ZodType>(item: TItem) {
  return z.object({
    items: z.array(item),
    total: z.number(),
    hasMore: z.boolean(),
    page: z.number(),
    pageSize: z.number(),
  });
}

/**
 * 游标分页的列表响应，无限滚动用：下一页传回 `nextCursor`，取严格排在上一页最后一条之后的记录，
 * 滚动期间有新记录插进前面也不会重复或漏掉。`nextCursor` 为 null 表示没有下一页；它的内容由服务端定义，调用方只原样传回。
 */
export function cursorPageSchema<TItem extends z.ZodType>(item: TItem) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });
}

function requestBody(data: unknown, headers: Headers) {
  if (data === undefined) return undefined;
  // multipart 的 boundary 由浏览器写进 Content-Type，手动设置会让服务端解析失败。
  if (data instanceof FormData || data instanceof Blob) return data;
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return JSON.stringify(data);
}

function parseBody(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
