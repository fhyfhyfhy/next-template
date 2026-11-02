"use client";

import { useIntersection } from "@mantine/hooks";
import { useTranslations } from "next-intl";
import { useEffect, useEffectEvent } from "react";

import { environmentManager, useInfiniteQuery } from "@/lib/react-query";

import { getFeedInfiniteQueryOptions } from "../../api/get-feed";
import { FeedCard } from "./feed-card";

/**
 * React Query owns the Gallery: scrolling to the bottom appends the next page.
 * The first page comes from the hydration state of the server cache.
 */
export function FeedGrid() {
  const t = useTranslations("demo-task");
  const feed = useInfiniteQuery({
    ...getFeedInfiniteQueryOptions(),
    // Reading the current time during prerendering would make Next defer this
    // part to the browser. Checking whether hydrated data is stale reads the
    // time, and "static" skips that check, so the first page renders on the
    // server and arrives with the HTML. The browser uses the default staleTime
    // as usual.
    ...(environmentManager.isServer() && { staleTime: "static" as const }),
  });
  const { ref: loadMoreRef, entry } = useIntersection<HTMLDivElement>();
  const loadMore = useEffectEvent(() => {
    if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
  });
  // Triggered only by entry: load when the sentinel enters or leaves the
  // viewport or remounts. Triggered by the query state instead, a failed load
  // with the sentinel still in view would retry endlessly.
  useEffect(() => {
    if (entry?.isIntersecting) loadMore();
  }, [entry]);

  if (feed.data) {
    const tasks = feed.data.pages.flatMap((page) => page.items);
    return (
      <div>
        <ul
          aria-label={t("feed.label")}
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {tasks.map((task) => (
            <li key={task.id}>
              <FeedCard task={task} />
            </li>
          ))}
        </ul>
        {/* The key follows the number of loaded pages: after a new page
            renders the sentinel remounts, and if it is still in view the
            next page loads. */}
        <div
          key={feed.data.pages.length}
          ref={loadMoreRef}
          data-testid="feed-end"
          className="py-6 text-center text-sm text-muted-foreground"
        >
          {feed.isFetchingNextPage && t("queryState.loading")}
          {!feed.hasNextPage && t("feed.noMore")}
          {feed.isFetchNextPageError && t("feed.loadMoreFailed")}
        </div>
      </div>
    );
  }
  if (feed.error) {
    return (
      <p className="text-sm text-destructive">{t("queryState.loadFailed")}</p>
    );
  }
  return (
    <p className="text-sm text-muted-foreground">{t("queryState.loading")}</p>
  );
}
