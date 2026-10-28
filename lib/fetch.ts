import queryString, {
  type StringifiableRecord,
  type StringifyOptions,
} from "query-string";
import { z } from "zod";

import { credentialHeaders } from "#credentials";

/** 业务接口路径，由 `resolveApiUrl` 拼到 API base URL 之后。 */
export type ApiPath = `/${string}`;

export interface FetchApiConfig<TSchema extends z.ZodType> extends Omit<
  RequestInit,
  "body"
> {
  url: ApiPath;
  /** 2xx 响应体必须通过的 schema；空响应体按 `null` 校验。 */
  schema: TSchema;
  /** Query 参数，值为 `undefined` 的键不会出现在 URL 中。 */
  params?: StringifiableRecord;
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

/** 接口返回非 2xx。`body` 是解析后的响应体，不是 JSON 时为原始文本。 */
export class ApiError extends Error {
  readonly url: ApiPath;
  readonly status: number;
  readonly body: unknown;

  constructor({ url, status, body }: ApiErrorInit) {
    super(`${url} responded with ${status}`);
    this.name = "ApiError";
    this.url = url;
    this.status = status;
    this.body = body;
  }
}

/** 2xx 响应体不符合 schema，说明前后端契约已经不一致。 */
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

/** React Query 的 `retry`：4xx 和 schema 不匹配重试也不会成功，其余失败最多重试 3 次。 */
export function shouldRetryRequest(failureCount: number, error: unknown) {
  if (error instanceof SchemaValidationError) return false;
  if (error instanceof ApiError && error.status < 500) return false;
  return failureCount < MAX_RETRIES;
}

/**
 * 请求业务接口并按 `schema` 校验 2xx 响应体，返回 schema 的输出。
 * 服务端经 Next 的 fetch 发出，一次 Server Component 渲染内相同的 GET 只发一次；传了 `signal` 的调用
 * 不参与（见 node_modules/next/dist/docs/01-app/03-api-reference/04-functions/fetch.md 的 Memoization）。
 * 非 2xx 抛 `ApiError`，校验失败抛 `SchemaValidationError`；网络错误和 `signal` 的中止原样抛出。
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
  if (!response.ok) {
    throw new ApiError({ url, status: response.status, body });
  }
  const result = schema.safeParse(body);
  if (!result.success) throw new SchemaValidationError(url, result.error);
  return result.data;
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
