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

/** 游标分页的无限列表只有第一页时的 query 数据：第一页的 pageParam 是空字符串（没有游标，见 api/get-feed.ts）。 */
export function firstPageData<TPage>(page: TPage): InfiniteData<TPage, string> {
  return { pages: [page], pageParams: [""] };
}

/**
 * 去掉 query 和 mutation 的 `meta` 里的函数值，比如 `suppressErrorToast` 和 `errorMessage` 的函数写法：函数不能
 * 序列化后传给 Client Component，浏览器里的 options 工厂仍带着它们。复制受影响的条目，不修改原对象，也保留
 * pending 的 promise 等其他字段。
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
  if (!entry.meta) return entry;
  const values = Object.entries(entry.meta);
  if (!values.some(([, value]) => typeof value === "function")) return entry;
  const meta = Object.fromEntries(
    values.filter(([, value]) => typeof value !== "function"),
  );
  return { ...entry, meta };
}
