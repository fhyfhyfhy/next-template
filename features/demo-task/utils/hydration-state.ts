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
 * Builds the hydration state by hand, as "Build a prerenderable hydration
 * state" in Next.js's TanStack Query guide does: `dehydrate()` reads the
 * current time, which fails during a Cache Components prerender, so this takes
 * `updatedAt` from the caller. `updatedAt` must come from the same cache read
 * as the data, so the two move forward together.
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

/** The query data of an infinite list that holds only its first page. */
export function firstPageData<TPage>(page: TPage): InfiniteData<TPage, number> {
  return { pages: [page], pageParams: [1] };
}

/**
 * Drops the `meta.suppressErrorToast` functions from queries and mutations: a
 * function can't be serialized to a Client Component, and the query factories
 * in the browser still carry it. Copies the affected entries rather than
 * changing the originals, and keeps their other fields, such as a pending
 * promise.
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
