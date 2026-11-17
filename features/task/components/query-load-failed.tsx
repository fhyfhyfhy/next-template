"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

interface QueryLoadFailedProps {
  /** 重新请求，比如 `() => void query.refetch()`。 */
  onRetry: () => void;
  /** 重新请求进行中，通常是 query 的 `isFetching`：这期间按钮停用，焦点留在按钮上。 */
  retrying: boolean;
}

/**
 * query 首次加载失败、没有数据可显示时的错误状态。没有数据的 query 失败时全局不弹提示
 * （`QueryClient` in lib/react-query.ts），这里是用户唯一能看到的提示，所以带上重试。
 */
export function QueryLoadFailed({ onRetry, retrying }: QueryLoadFailedProps) {
  const t = useTranslations();
  return (
    <div role="alert" className="text-sm">
      <p className="text-destructive">{t("task.queryState.loadFailed")}</p>
      <Button
        variant="outline"
        size="sm"
        className="mt-2"
        disabled={retrying}
        focusableWhenDisabled
        onClick={onRetry}
      >
        {t("task.queryState.retry")}
      </Button>
    </div>
  );
}
