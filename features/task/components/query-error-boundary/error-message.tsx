"use client";

import { useQueryErrorResetBoundary } from "@/lib/react-query";

import { LoadFailedAlert } from "../load-failed-alert";

export interface QueryErrorBoundaryProps {
  /** 出错时显示的提示，比如“评论加载失败”。 */
  message: string;
  /** 重试按钮的可访问名称，整句，比如“重试加载评论”（见 `LoadFailedAlert`）。 */
  retryLabel: string;
  /** 点了重试、边界开始重新渲染内容之后调用。 */
  onRetry?: () => void;
}

interface ErrorMessageProps extends QueryErrorBoundaryProps {
  retry: () => void;
}

export function ErrorMessage({
  message,
  retryLabel,
  onRetry,
  retry,
}: ErrorMessageProps) {
  const { reset } = useQueryErrorResetBoundary();
  return (
    <LoadFailedAlert
      message={message}
      retryLabel={retryLabel}
      onRetry={() => {
        // 先重置 React Query 的错误边界状态，否则重新挂载的 suspense query 会直接沿用上次的错误。
        reset();
        retry();
        onRetry?.();
      }}
    />
  );
}
