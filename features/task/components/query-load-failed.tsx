"use client";

import { useTranslations } from "next-intl";

import type { QueryLoadState } from "../utils/query-load-state";
import { LoadFailedAlert } from "./load-failed-alert";

interface QueryLoadFailedProps {
  /** 加载失败的 query：重试调它的 `refetch`，`fetchStatus` 不为 idle（请求中或暂停着，见 `isQueryLoadFailed`）算重试进行中。 */
  query: QueryLoadState & { refetch: () => Promise<unknown> };
  /** 重试按钮的可访问名称，整句，比如“重试加载我的收藏”（见 `LoadFailedAlert`）。 */
  retryLabel: string;
}

/**
 * query 首次加载失败、没有数据可显示时的错误状态，在 `isQueryLoadFailed(query)` 时渲染。没有数据的 query
 * 失败时全局不弹提示（lib/react-query.ts 的 `QueryClient`），这里是用户唯一能看到的提示，所以带上重试。
 */
export function QueryLoadFailed({ query, retryLabel }: QueryLoadFailedProps) {
  const t = useTranslations();
  return (
    <LoadFailedAlert
      message={t("task.queryState.loadFailed")}
      retryLabel={retryLabel}
      retrying={query.fetchStatus !== "idle"}
      onRetry={() => void query.refetch()}
    />
  );
}
