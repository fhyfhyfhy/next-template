"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { useQueryErrorResetBoundary } from "@/lib/react-query";

export interface QueryErrorBoundaryProps {
  /** 出错时显示的提示，比如“评论加载失败”。 */
  message: string;
}

interface ErrorMessageProps extends QueryErrorBoundaryProps {
  retry: () => void;
}

export function ErrorMessage({ message, retry }: ErrorMessageProps) {
  const t = useTranslations("demo-task.queryErrorBoundary");
  const { reset } = useQueryErrorResetBoundary();
  return (
    <div
      role="alert"
      className="rounded-panel border border-destructive/40 p-4 text-sm"
    >
      <p>{message}</p>
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
        {t("retry")}
      </Button>
    </div>
  );
}
