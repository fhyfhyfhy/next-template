import {
  defaultShouldDehydrateQuery,
  type DehydratedState,
  type InfiniteData,
  QueryClient,
  type QueryKey,
} from "@/lib/react-query";

interface HydratedQuery {
  queryKey: QueryKey;
  data: unknown;
}

/**
 * 按 Next.js TanStack Query 指南的 “Build a prerenderable hydration state” 手动构造 hydration state：
 * `dehydrate()` 在 Cache Components 预渲染时读当前时间会报错，这里用调用方给的 `updatedAt`。
 * `updatedAt` 必须和数据来自同一次缓存读取，数据变化时一起前进。
 */
export function buildHydrationState(
  queries: HydratedQuery[],
  updatedAt: number,
): DehydratedState {
  const queryClient = new QueryClient();
  for (const query of queries) {
    queryClient.setQueryData(query.queryKey, query.data, { updatedAt });
  }
  return {
    mutations: [],
    queries: queryClient
      .getQueryCache()
      .getAll()
      .filter((query) => defaultShouldDehydrateQuery(query))
      .map((query) => ({
        dehydratedAt: updatedAt,
        queryHash: query.queryHash,
        queryKey: query.queryKey,
        state: query.state,
        ...(query.meta ? { meta: query.meta } : {}),
      })),
  };
}

/** 无限列表只有第一页时的 query 数据。 */
export function firstPageData<TPage>(page: TPage): InfiniteData<TPage, number> {
  return { pages: [page], pageParams: [1] };
}

/**
 * 去掉 query 和 mutation 的 `meta.suppressErrorToast` 函数：函数不能序列化后传给 Client Component，
 * 浏览器里的 query 工厂仍带着它。复制受影响的条目，不修改原对象，也保留 pending 的 promise 等其他字段。
 */
export function omitFunctionMeta(state: DehydratedState): DehydratedState {
  return {
    ...state,
    queries: state.queries.map(withoutFunctionMeta),
    mutations: state.mutations.map(withoutFunctionMeta),
  };
}

function withoutFunctionMeta<TEntry extends { meta?: Record<string, unknown> }>(
  entry: TEntry,
): TEntry {
  if (typeof entry.meta?.suppressErrorToast !== "function") return entry;
  const meta = { ...entry.meta };
  delete meta.suppressErrorToast;
  return { ...entry, meta };
}
