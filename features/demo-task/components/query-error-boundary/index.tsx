"use client";

import { catchError, type ErrorInfo } from "next/error";

import { ErrorMessage, type QueryErrorBoundaryProps } from "./error-message";

/**
 * `useSuspenseQuery` 首次加载失败时的局部错误边界，免得错误冒到路由的 error.tsx 把整页换掉。
 * 已经有数据的 query 后台刷新失败不会到这里，按全局 toast 的规则提示。
 */
export const QueryErrorBoundary = catchError(function QueryErrorFallback(
  { title }: QueryErrorBoundaryProps,
  { retry }: ErrorInfo,
) {
  return <ErrorMessage title={title} retry={retry} />;
});
