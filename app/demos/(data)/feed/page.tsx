import type { Metadata } from "next";
import { Suspense } from "react";

import {
  FavoritesPanel,
  FeedGrid,
  FeedSkeleton,
  getFeedInfiniteQueryOptions,
  MOCK_API_RUNNING,
  PageIntro,
  SeedHydrationBoundary,
} from "@/features/demo-task";
import {
  buildHydrationState,
  firstPageData,
  getCachedFeedSnapshot,
} from "@/features/demo-task/server";

export const metadata: Metadata = { title: "作品广场 · Data demo" };

export default function FeedPage() {
  return (
    <>
      <PageIntro title="作品广场">
        <p>
          已完成的任务按创建时间排列，滚到底部自动加载下一页，数据由 React Query
          负责。第一页来自服务端缓存的快照，在服务端渲染好、随 HTML
          送达，浏览器不用再请求第一页。
        </p>
        <p>
          收藏走 React Query
          的乐观更新：卡片和右侧“我的收藏”同时变化，失败时一起回滚。它和全部任务页的收藏写同一个字段，但那边的数据由
          Server Component 负责，用的是 useOptimistic。
        </p>
      </PageIntro>
      <div className="grid gap-8 lg:grid-cols-[1fr_240px]">
        {/* FeedHydration 要等缓存的快照：HTML 里先是骨架屏，第一页作为片段写在同一份 HTML 后面，由内联脚本换上，不用等应用的 JS。 */}
        <Suspense fallback={<FeedSkeleton />}>
          <FeedHydration />
        </Suspense>
        <FavoritesPanel />
      </div>
    </>
  );
}

async function FeedHydration() {
  if (!MOCK_API_RUNNING) return null;
  const { page, fetchedAt } = await getCachedFeedSnapshot();
  // dehydrate() 预渲染时会读当前时间；这里按缓存快照的时间戳手动构造 hydration state。
  const state = buildHydrationState(
    [
      {
        queryKey: getFeedInfiniteQueryOptions().queryKey,
        data: firstPageData(page),
      },
    ],
    fetchedAt,
  );
  return (
    <SeedHydrationBoundary state={state}>
      <FeedGrid />
    </SeedHydrationBoundary>
  );
}
