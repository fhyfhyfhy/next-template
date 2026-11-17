"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/** `useQuery`、`useInfiniteQuery` 的结果里，加载失败的状态要读的字段。 */
interface LoadingQuery {
  data: unknown;
  error: unknown;
  isFetching: boolean;
  errorUpdateCount: number;
  refetch: () => Promise<unknown>;
}

/**
 * query 没有数据、要显示加载失败：首次加载失败了，或者失败后的重试还在进行。没有数据的 query 重新请求时，
 * React Query 在同一次更新里把 `error` 清空、`status` 改回 pending（query-core 的 `fetchState`），只看 `error`
 * 的话，一点重试错误状态就卸载，聚焦的重试按钮跟着消失、焦点掉到 body；`errorUpdateCount` 记着它失败过。
 */
export function isQueryLoadFailed(query: LoadingQuery) {
  return (
    query.data === undefined &&
    (query.error !== null || (query.isFetching && query.errorUpdateCount > 0))
  );
}

interface QueryLoadFailedProps {
  /** 加载失败的 query：重试调它的 `refetch`，请求进行中（`isFetching`）按钮停用。 */
  query: LoadingQuery;
  /** 加载的是什么，比如“我的收藏”：重试按钮的可访问名称写明它，同一页上的几个重试按钮才分得清。 */
  subject: string;
}

/**
 * query 首次加载失败、没有数据可显示时的错误状态，在 `isQueryLoadFailed(query)` 时渲染。没有数据的 query
 * 失败时全局不弹提示（`QueryClient` in lib/react-query.ts），这里是用户唯一能看到的提示，所以带上重试。
 * 重试进行中这个状态一直显示，按钮停用但保持可聚焦，焦点留在按钮上。
 */
export function QueryLoadFailed({ query, subject }: QueryLoadFailedProps) {
  const t = useTranslations();
  return (
    <div role="alert" className="text-sm">
      <p className="text-destructive">{t("task.queryState.loadFailed")}</p>
      <Button
        variant="outline"
        size="sm"
        className="mt-2"
        // 可访问名称要包含看得见的“重试”，各语言的 retryLabel 都以它开头，再写明重试的是什么。
        aria-label={t("task.queryState.retryLabel", { subject })}
        disabled={query.isFetching}
        focusableWhenDisabled
        onClick={() => void query.refetch()}
      >
        {t("task.queryState.retry")}
      </Button>
    </div>
  );
}
