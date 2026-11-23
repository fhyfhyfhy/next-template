/** `useQuery`、`useInfiniteQuery` 的结果里，判断加载是否失败要读的字段。 */
export interface QueryLoadState {
  data: unknown;
  error: unknown;
  isFetching: boolean;
  isFetchedAfterMount: boolean;
}

/**
 * query 没有数据、要显示加载失败：首次加载失败了，或者本次挂载里失败过、重试还在进行。没有数据的 query 重新请求时，
 * React Query 在同一次更新里把 `error` 清空、`status` 改回 pending（query-core 的 `fetchState`），只看 `error`
 * 的话，一点重试错误状态就卸载，聚焦的重试按钮跟着消失、焦点掉到 body。`isFetchedAfterMount` 只算本次挂载里结束的
 * 请求：之前失败过的 query 重新挂载时（比如后退回来）照常显示加载中。
 */
export function isQueryLoadFailed(query: QueryLoadState) {
  return (
    query.data === undefined &&
    (query.error !== null || (query.isFetching && query.isFetchedAfterMount))
  );
}
