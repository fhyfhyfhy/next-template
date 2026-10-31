"use client";

import { Button } from "@/components/ui/button";
import { useQueryErrorResetBoundary } from "@/lib/react-query";

export interface QueryErrorBoundaryProps {
  /** 出错区域的名称，比如“评论”。 */
  title: string;
}

interface ErrorMessageProps extends QueryErrorBoundaryProps {
  retry: () => void;
}

export function ErrorMessage({ title, retry }: ErrorMessageProps) {
  const { reset } = useQueryErrorResetBoundary();
  return (
    <div
      role="alert"
      className="rounded-panel border border-destructive/40 p-4 text-sm"
    >
      <p>{title}加载失败</p>
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
