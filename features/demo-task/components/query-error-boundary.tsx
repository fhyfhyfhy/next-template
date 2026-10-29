"use client";

import { catchError, type ErrorInfo } from "next/error";

import { Button } from "@/components/ui/button";
import { useQueryErrorResetBoundary } from "@/lib/react-query";

interface QueryErrorBoundaryProps {
  /** 出错区域的名称，比如“评论”。 */
  title: string;
}

/**
 * `useSuspenseQuery` 首次加载失败时的局部错误边界，免得错误冒到路由的 error.tsx 把整页换掉。
 * 已经有数据的 query 后台刷新失败不会到这里，按全局 toast 的规则提示。
 */
export const QueryErrorBoundary = catchError(function QueryErrorFallback(
  { title }: QueryErrorBoundaryProps,
  { error, retry }: ErrorInfo,
) {
  return <ErrorMessage title={title} error={error} retry={retry} />;
});

interface ErrorMessageProps extends QueryErrorBoundaryProps {
  error: unknown;
  retry: () => void;
}

function ErrorMessage({ title, error, retry }: ErrorMessageProps) {
  const { reset } = useQueryErrorResetBoundary();
  return (
    <div
      role="alert"
      className="rounded-panel border border-destructive/40 p-4 text-sm"
    >
      <p>
        {title}加载失败：
        {error instanceof Error ? error.message : String(error)}
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={() => {
          // 先重置 React Query 的错误边界状态，否则重新挂载的 suspense query 会直接沿用上次的错误。
          reset();
          retry();
        }}
      >
        重试
      </Button>
    </div>
  );
}
