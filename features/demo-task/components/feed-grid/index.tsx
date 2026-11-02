"use client";

import { useIntersection } from "@mantine/hooks";
import { useTranslations } from "next-intl";
import { useEffect, useEffectEvent } from "react";

import { environmentManager, useInfiniteQuery } from "@/lib/react-query";

import { getFeedInfiniteQueryOptions } from "../../api/get-feed";
import { FeedCard } from "./feed-card";

/** 作品广场由 React Query 负责：滚到底部时追加下一页。第一页来自服务端缓存的 hydration state。 */
export function FeedGrid() {
  const t = useTranslations("demo-task");
  const feed = useInfiniteQuery({
    ...getFeedInfiniteQueryOptions(),
    // 预渲染时读当前时间会让 Next 把这块推迟到浏览器渲染。hydrate 进来的数据判断过期时会读时间，
    // "static" 跳过这一步，第一页因此在服务端渲染、随 HTML 送达；浏览器里照常用默认的 staleTime。
    ...(environmentManager.isServer() && { staleTime: "static" as const }),
  });
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
          aria-label={t("feed.label")}
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
