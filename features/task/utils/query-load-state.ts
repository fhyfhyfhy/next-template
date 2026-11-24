import type { FetchStatus } from "@/lib/react-query";

/** `useQuery`、`useInfiniteQuery` 的结果里，判断加载是否失败要读的字段。 */
export interface QueryLoadState {
  data: unknown;
  error: unknown;
  fetchStatus: FetchStatus;
  isFetchedAfterMount: boolean;
}

/**
 * query 没有数据、要显示加载失败：首次加载失败了，或者本次挂载里失败过、重试还没结束。重试没结束包括请求暂停：离线，
 * 或者标签页在后台时的重试退避，`fetchStatus` 是 paused 而不是 fetching，所以看的是它不为 idle。没有数据的 query
 * 重新请求时，React Query 在同一次更新里把 `error` 清空、`status` 改回 pending（query-core 的 `fetchState`），只看
 * `error` 的话，一点重试错误状态就卸载，聚焦的重试按钮跟着消失、焦点掉到 body。
 * `isFetchedAfterMount` 只算这个 observer 创建以来结束的请求：重新挂载（新的 observer）时，之前失败过的 query 照常
 * 显示加载中。Next.js 用 `<Activity>` 保留的页面（Cache Components）不重新挂载，observer 还是原来的：后退回来时
 * 照旧显示失败，重新请求期间重试按钮停用。
 */
export function isQueryLoadFailed(query: QueryLoadState) {
  return (
    query.data === undefined &&
    (query.error !== null ||
      (query.fetchStatus !== "idle" && query.isFetchedAfterMount))
  );
}
