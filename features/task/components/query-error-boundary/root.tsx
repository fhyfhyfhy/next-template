"use client";

import { catchError, type ErrorInfo } from "next/error";
import { type ReactNode, useRef } from "react";

import { RetryFocusContext } from "./context";
import { ErrorMessage, type QueryErrorBoundaryProps } from "./error-message";

const CatchQueryError = catchError(function QueryErrorFallback(
  { message, retryLabel }: QueryErrorBoundaryProps,
  { retry }: ErrorInfo,
) {
  return (
    <ErrorMessage message={message} retryLabel={retryLabel} retry={retry} />
  );
});

/**
 * `useSuspenseQuery` 首次加载失败时的局部错误边界，免得错误冒到路由的 error.tsx 把整页换掉。
 * 已经有数据的 query 后台刷新失败不会到这里，按全局 toast 的规则提示。
 * 重试时 Suspense 的 fallback 换掉了刚按的重试按钮，焦点掉到 body：重试又失败时，边界把焦点移到新的重试按钮；重试成功时
 * 由内容旁的 `FocusAfterRetry` 移，所以在内容所在的 Suspense 里放一个。
 */
export function QueryErrorBoundary({
  message,
  retryLabel,
  children,
}: QueryErrorBoundaryProps & { children: ReactNode }) {
  // 只在事件处理和 effect 里读写，改了不用重新渲染，所以用 ref。
  const retriedRef = useRef(false);
  const retryFocus = {
    markRetried: () => {
      retriedRef.current = true;
    },
    takeRetried: () => {
      const retried = retriedRef.current;
      retriedRef.current = false;
      return retried;
    },
  };
  return (
    <RetryFocusContext value={retryFocus}>
      <CatchQueryError message={message} retryLabel={retryLabel}>
        {children}
      </CatchQueryError>
    </RetryFocusContext>
  );
}
