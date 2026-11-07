"use client";

import { type ReactNode, useMemo } from "react";

import {
  type DehydratedState,
  HydrationBoundary,
  useQueryClient,
} from "@/lib/react-query";

interface SeedHydrationBoundaryProps {
  state: DehydratedState;
  children: ReactNode;
}

/**
 * 只把浏览器里还没有数据的 query 交给 `HydrationBoundary`，已有的由 React Query 自己刷新。
 * 服务端的 state 只带无限列表的第一页，时间戳又比浏览器里的新，原样 hydrate 会把已加载的几页换回一页：
 * 这一页上的 Server Action 让列表 tag 失效后，响应带回的页面正好送来这样一份 state。
 */
export function SeedHydrationBoundary({
  state,
  children,
}: SeedHydrationBoundaryProps) {
  const client = useQueryClient();
  const seed = useMemo(
    () => ({
      ...state,
      queries: state.queries.filter(
        (query) =>
          client.getQueryCache().get(query.queryHash)?.state.data === undefined,
      ),
    }),
    [client, state],
  );
  return <HydrationBoundary state={seed}>{children}</HydrationBoundary>;
}
