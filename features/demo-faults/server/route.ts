import "server-only";

import { isDemoBackendEnabled } from "@/lib/demo-backend";
import {
  DomainError,
  errorBody,
  ErrorCode,
  notFound,
} from "@/lib/domain-error";
import { routeHandler } from "@/lib/route-handler";

import { INJECTED_FAILURE_CODE } from "../constants/demo-faults";
import { HttpFaultError, runAsHttpRequest } from "./operations";

/**
 * `/api/demo` 下 Route Handler 的适配层：Demo backend 没有启用时一律 404；其余情况交给 `routeHandler`，
 * `handler` 里的数据层调用记为来自 HTTP（调用记录和只在 HTTP 上生效的故障据此区分），只在 HTTP 上生效的故障
 * 转成对应的响应。
 */
export function demoRoute<TContext>(
  handler: (request: Request, context: TContext) => Promise<unknown>,
) {
  return routeHandler<TContext>(async (request, context) => {
    // 开启 Cache Components 后，GET 会在 build 时尝试预渲染；handler 一读数据库，预渲染就停下、改在请求时执行
    // （node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md 的 With Cache Components）。
    // Demo backend 没有启用的 build 里，这里的 404 会被预渲染成静态响应，正好就是要的结果。
    if (!isDemoBackendEnabled()) {
      return Response.json(errorBody(notFound("Not found")), { status: 404 });
    }
    return runAsHttpRequest(async () => {
      try {
        return await handler(request, context);
      } catch (error) {
        if (error instanceof HttpFaultError) return faultResponse(error);
        throw error;
      }
    });
  });
}

function faultResponse({ fault }: HttpFaultError): Response {
  const { kind, status, code } = fault;
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
