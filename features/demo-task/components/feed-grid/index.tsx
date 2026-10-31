"use client";

import { useIntersection } from "@mantine/hooks";
import { useEffect, useEffectEvent } from "react";

import { useInfiniteQuery } from "@/lib/react-query";

import { getFeedInfiniteQueryOptions } from "../../api/get-feed";
import { FeedCard } from "./feed-card";

/** 作品广场由 React Query 负责：滚到底部时追加下一页。第一页来自服务端缓存的 hydration state。 */
export function FeedGrid() {
  const feed = useInfiniteQuery(getFeedInfiniteQueryOptions());
  const { ref: loadMoreRef, entry } = useIntersection<HTMLDivElement>();
  const loadMore = useEffectEvent(() => {
    if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
  });
  // 只随 entry 触发：哨兵进出视口或重新挂载时才加载。改成随 query 状态触发的话，
  // 加载失败后哨兵还在视口里，就会不停重试。
  useEffect(() => {
    if (entry?.isIntersecting) loadMore();
  }, [entry]);

  if (feed.data) {
    const tasks = feed.data.pages.flatMap((page) => page.items);
    return (
      <div>
        <ul
          aria-label="作品"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {tasks.map((task) => (
            <li key={task.id}>
              <FeedCard task={task} />
            </li>
          ))}
        </ul>
        {/* key 跟着已加载的页数变：新的一页渲染后哨兵重新挂载，仍在视口里时会继续加载下一页。 */}
        <div
          key={feed.data.pages.length}
          ref={loadMoreRef}
          data-testid="feed-end"
          className="py-6 text-center text-sm text-muted-foreground"
        >
          {feed.isFetchingNextPage && "加载中…"}
          {!feed.hasNextPage && "没有更多作品了"}
          {feed.isFetchNextPageError && "加载失败，滚动到这里会重试"}
        </div>
      </div>
    );
  }
  if (feed.error) {
    return <p className="text-sm text-destructive">加载失败</p>;
  }
  return <p className="text-sm text-muted-foreground">加载中…</p>;
}
