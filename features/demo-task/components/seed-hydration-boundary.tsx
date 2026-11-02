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
 * Hands `HydrationBoundary` only the queries the browser has no data for yet;
 * React Query refreshes the rest itself. The server's state carries only an
 * infinite list's first page, with a newer timestamp than the browser's, so
 * hydrating it as is would replace the loaded pages with one. That is exactly
 * the state that arrives with the page sent back after a Server Action on this
 * page expires the list tag.
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
