import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";

import {
  badRequest,
  DomainError,
  errorBody,
  ErrorCode,
  notFound,
} from "@/lib/domain-error";

import { INJECTED_FAILURE_CODE } from "../constants/demo-faults";
import {
  type TaskFilters,
  taskSortSchema,
  taskStatusSchema,
} from "../types/task-filters";
import { isDemoBackendEnabled } from "./connection";
import { HttpFaultError, runAsHttpRequest } from "./demo-controls";

/**
 * `/api/demo` 下 Route Handler 的适配层：Demo backend 没有启用时一律 404；其余情况执行 `handler`，返回值序列化成
 * JSON（返回 `Response` 时原样发出），数据层抛出的 `DomainError` 转成 `lib/fetch.ts` 解析的失败响应，
 * 其他错误记日志后返回 500。`handler` 里的数据层调用记为来自 HTTP（调用记录和只在 HTTP 上生效的故障据此区分）。
 */
export function demoRoute<TContext>(
  handler: (request: Request, context: TContext) => Promise<unknown>,
) {
  return async (request: Request, context: TContext): Promise<Response> => {
    // 开启 Cache Components 后，GET 会在 build 时尝试预渲染；handler 一读数据库，预渲染就停下、改在请求时执行
    // （node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md 的 With Cache Components）。
    // Demo backend 没有启用的 build 里，这里的 404 会被预渲染成静态响应，正好就是要的结果。
    if (!isDemoBackendEnabled()) {
      return Response.json(errorBody(notFound("Not found")), { status: 404 });
    }
    return runAsHttpRequest(async () => {
      try {
        const result = await handler(request, context);
        return result instanceof Response ? result : Response.json(result);
      } catch (error) {
        // build 时预渲染读到 request.url 等请求数据会抛出 Next 自己的中断信号，要交还给 Next，不能当成 500。
        unstable_rethrow(error);
        return errorResponse(error);
      }
    });
  };
}

/**
 * 按 `schema` 解析请求体的 JSON；没有请求体时按 null 解析。不是合法 JSON 或不符合 schema 时按参数错误拒绝，
 * `param` 是第一个出错的字段。
 */
export async function readJsonBody<TSchema extends z.ZodType>(
  request: Request,
  schema: TSchema,
): Promise<z.output<TSchema>> {
  const text = await request.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      throw badRequest("Request body is not valid JSON");
    }
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    const [issue] = result.error.issues;
    throw badRequest(`Invalid request body: ${result.error.message}`, {
      param: issue?.path.join("."),
    });
  }
  return result.data;
}

/** 任务列表接口的 query：`status` 可以重复多个，其余都是单值；不合法的值按参数错误拒绝。 */
export function parseTaskFilters(params: URLSearchParams): TaskFilters {
  const status = taskStatusSchema.array().safeParse(params.getAll("status"));
  if (!status.success) throw badRequest("Invalid status", { param: "status" });
  const sort = params.get("sort");
  const parsedSort = sort === null ? undefined : taskSortSchema.safeParse(sort);
  if (parsedSort && !parsedSort.success) {
    throw badRequest("Invalid sort", { param: "sort" });
  }
  const favorite = params.get("favorite");
  return {
    status: status.data,
    favorite: favorite === null ? undefined : favorite === "true",
    prompt: params.get("prompt") ?? undefined,
    excludeId: params.get("excludeId") ?? undefined,
    sort: parsedSort?.data,
    page: integerParam(params, "page"),
    pageSize: integerParam(params, "pageSize"),
  };
}

export function integerParam(params: URLSearchParams, name: string) {
  const value = params.get(name);
  if (value === null) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw badRequest(`${name} must be an integer`, { param: name });
  }
  return parsed;
}

function errorResponse(error: unknown): Response {
  if (error instanceof HttpFaultError) {
    const { kind, status, code } = error.fault;
    if (kind === "httpStatus") {
      const httpStatus = status ?? 500;
      return Response.json(
        errorBody(
          new DomainError(
            httpStatus,
            httpStatus >= 500 ? ErrorCode.SERVER_ERROR : httpStatus * 100,
            `Injected ${httpStatus} error`,
          ),
        ),
        { status: httpStatus },
      );
    }
    if (kind === "errorOnSuccess") {
      const injectedCode = code ?? INJECTED_FAILURE_CODE;
      return Response.json({
        error: {
          code: injectedCode,
          message: `Injected error code ${injectedCode}`,
        },
      });
    }
    // malformed：2xx，但响应体不符合任何接口的 schema，演示前后端契约不一致。
    return Response.json({ unexpected: true });
  }
  if (error instanceof DomainError) {
    return Response.json(errorBody(error), { status: error.status });
  }
  console.error(error);
  return Response.json(
    errorBody(
      new DomainError(500, ErrorCode.SERVER_ERROR, "Internal server error"),
    ),
    { status: 500 },
  );
}
