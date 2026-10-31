import queryString, {
  type StringifiableRecord,
  type StringifyOptions,
} from "query-string";
import { z } from "zod";

import { credentialHeaders } from "#credentials";

/** 业务接口路径，由 `resolveApiUrl` 拼到 API base URL 之后。 */
export type ApiPath = `/${string}`;

// 失败响应体 `{ error: { code, message, param?, params? } }` 里的错误对象。`message` 面向开发者，
// UI 按 `code` 和 `params` 生成文案。后端的错误格式不同时在这里映射（setup-data-access skill）。
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
  /**
   * 是否附加 `#credentials` 提供的当前用户凭证，默认附加；同名 header 以调用方传的为准，
   * 浏览器自己携带的 cookie 不受它影响。公开接口传 `false`：服务端取凭证会读本次请求的 cookie，
   * `use cache` 里不能读。
   * @default true
   */
  auth?: boolean;
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
 * 业务接口的完整 URL，base URL 来自 `NEXT_PUBLIC_API_BASE_URL`。
 * 未配置时得到同源相对路径，只能在浏览器中请求。
 */
export function resolveApiUrl(path: ApiPath): string {
  return `${process.env.NEXT_PUBLIC_API_BASE_URL ?? ""}${path}`;
}

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
 * 请求业务接口，按 `schema` 校验响应体，返回 schema 的输出。
 * 服务端经 Next 的 fetch 发出，一次 Server Component 渲染内相同的 GET 只发一次；传了 `signal` 的调用
 * 不参与（见 node_modules/next/dist/docs/01-app/03-api-reference/04-functions/fetch.md 的 Memoization）。
 * HTTP 非 2xx 或 2xx 的响应体只有 `error` 对象时抛 `ApiError`，响应体校验失败抛 `SchemaValidationError`；
 * 网络错误和 `signal` 的中止原样抛出。
 */
export async function fetchApi<TSchema extends z.ZodType>({
  url,
  schema,
  params,
  paramsSerializer,
  data,
  auth = true,
  headers,
  ...init
}: FetchApiConfig<TSchema>): Promise<z.output<TSchema>> {
  const requestHeaders = new Headers(headers);
  if (auth) {
    for (const [name, value] of Object.entries(await credentialHeaders())) {
      if (!requestHeaders.has(name)) requestHeaders.set(name, value);
    }
  }
  const response = await fetch(
    queryString.stringifyUrl(
      { url: resolveApiUrl(url), query: params },
      paramsSerializer,
    ),
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

/** 页码分页的列表响应，用作 `fetchApi` 的 `schema`。后端的分页字段不同时在这里映射。 */
export function pageSchema<TItem extends z.ZodType>(item: TItem) {
  return z.object({
    items: z.array(item),
    total: z.number(),
    hasMore: z.boolean(),
    page: z.number(),
    pageSize: z.number(),
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
