import queryString, {
  type StringifiableRecord,
  type StringifyOptions,
} from "query-string";
import { z } from "zod";

import { credentialHeaders } from "#credentials";

/** A backend API path, which `resolveApiUrl` appends to the API base URL. */
export type ApiPath = `/${string}`;

// The error object in a failure body, `{ error: { code, message, param?, params? } }`. `message` is
// for developers; the UI builds its copy from `code` and `params`. Map a backend's other error
// format here (setup-data-access skill).
const errorSchema = z.object({
  code: z.number(),
  message: z.string(),
  param: z.string().optional(),
  params: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});
const errorBodySchema = z.object({ error: errorSchema });
// A 2xx is a failure only when `error` is the body's one field and matches errorSchema: a resource
// may carry an `error` field of its own (such as why a task failed), and is still a success; a
// malformed one such as `{ error: "boom" }` is validated against the schema.
const errorOnlyBodySchema = z.strictObject({ error: errorSchema });

export interface FetchApiConfig<TSchema extends z.ZodType> extends Omit<
  RequestInit,
  "body"
> {
  /** The API path without a query: query parameters go in `params`. */
  url: ApiPath;
  /**
   * The schema the response body must pass; an empty body (such as a 204) is validated as `null`.
   * A success response is the resource itself; a list puts its array in `items`, and a list paged
   * by page number uses `pageSchema`.
   */
  schema: TSchema;
  /** Query parameters; a key whose value is `undefined` is left out of the URL. */
  params?: StringifiableRecord;
  /** Passed to query-string's `stringifyUrl`, such as how to write arrays; the default is `status=a&status=b`. */
  paramsSerializer?: StringifyOptions;
  /** The request body: `FormData` and `Blob` are sent as they are, any other value as JSON. */
  data?: unknown;
  /**
   * Whether to attach the current user's credentials from `#credentials`, attached by default; a
   * header of the same name from the caller wins, and the cookies the browser sends on its own are
   * unaffected. Pass `false` for public endpoints: on the server, getting the credentials reads this
   * request's cookies, which `use cache` cannot read.
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
 * An API failure: an HTTP status other than 2xx, or a 2xx whose body is only a well-formed `error`
 * object (`status` is then the 2xx). `status` is always set: use it for generic failures such as
 * signed out, rate limited or unavailable. `code`, `param` and `params` come from the body's `error`
 * object, and are all `undefined` when the body has another format (such as a gateway's error page);
 * `body` is the parsed body, or the raw text when it is not JSON. `message` joins the URL, the status
 * and the backend's `error.message` for developers and logs; the UI never shows it, and builds its
 * copy from `code` and `params` instead.
 */
export class ApiError extends Error {
  readonly url: ApiPath;
  readonly status: number;
  /** The backend's error code. */
  readonly code: number | undefined;
  /** The name of the request field the error is about. */
  readonly param: string | undefined;
  /** The values the translated copy interpolates. */
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

/** A 2xx body does not match the schema: the frontend and the backend no longer agree on the contract. */
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
 * The full URL of a backend API path, with the base URL from `NEXT_PUBLIC_API_BASE_URL`.
 * Unset, it is a same-origin relative path, which only the browser can request.
 */
export function resolveApiUrl(path: ApiPath): string {
  return `${process.env.NEXT_PUBLIC_API_BASE_URL ?? ""}${path}`;
}

/**
 * React Query's `retry`: a 4xx, an `error` on a 2xx and a schema mismatch would fail again, so they
 * are not retried; any other failure is retried up to 3 times, a 5xx, a network error and any other
 * exception thrown in `queryFn` included.
 */
export function shouldRetryRequest(failureCount: number, error: unknown) {
  if (error instanceof SchemaValidationError) return false;
  if (error instanceof ApiError && error.status < 500) return false;
  return failureCount < MAX_RETRIES;
}

/**
 * Requests a backend API, validates the response body against `schema` and returns the schema's output.
 * On the server it goes through Next's fetch, which sends an identical GET only once per Server
 * Component render; a call that passes `signal` is left out (Memoization in
 * node_modules/next/dist/docs/01-app/03-api-reference/04-functions/fetch.md).
 * Throws `ApiError` for an HTTP status other than 2xx or a 2xx whose body is only an `error` object,
 * and `SchemaValidationError` when the body fails validation; network errors and `signal`'s abort
 * are thrown as they are.
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

/** A list response paged by page number, for `fetchApi`'s `schema`. Map a backend's other paging fields here. */
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
  // The browser writes the multipart boundary into Content-Type; setting it by hand makes the
  // server fail to parse the body.
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
