import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";

import { badRequest, DomainError, errorBody, ErrorCode } from "./domain-error";

/**
 * Route Handler 的适配层：执行 `handler`，返回值序列化成 JSON（返回 `Response` 时原样发出），数据层抛出的
 * `DomainError` 转成 `lib/fetch.ts` 解析的失败响应，其他错误记日志后返回 500。
 */
export function routeHandler<TContext>(
  handler: (request: Request, context: TContext) => Promise<unknown>,
) {
  return async (request: Request, context: TContext): Promise<Response> => {
    try {
      const result = await handler(request, context);
      return result instanceof Response ? result : Response.json(result);
    } catch (error) {
      // build 时预渲染读到 request.url 等请求数据会抛出 Next 自己的中断信号，要交还给 Next，不能当成 500。
      unstable_rethrow(error);
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

/** 读一个整数 query 参数；没有时返回 undefined，不是整数时按参数错误拒绝。 */
export function integerParam(params: URLSearchParams, name: string) {
  const value = params.get(name);
  if (value === null) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw badRequest(`${name} must be an integer`, { param: name });
  }
  return parsed;
}
