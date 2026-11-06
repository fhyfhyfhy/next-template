import type { Metadata } from "next";
import { connection } from "next/server";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import {
  FavoritesPanel,
  FavoritesPanelSkeleton,
  favoriteTasksQueryOptions,
  FeedGrid,
  FeedSkeleton,
  getFeedInfiniteQueryOptions,
  PageIntro,
  SeedHydrationBoundary,
  taskFiltersOf,
} from "@/features/demo-task";
import {
  buildHydrationState,
  firstPageData,
  getCachedFeedSnapshot,
  listTasks,
} from "@/features/demo-task/server";
import { isDemoBackendEnabled } from "@/lib/demo-backend";
import {
  dehydrate,
  HydrationBoundary,
  noop,
  QueryClient,
} from "@/lib/react-query";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return { title: t("demos.feed.metadataTitle") };
}

export default function FeedPage() {
  const t = useTranslations("app");
  return (
    <>
      <PageIntro title={t("demos.feed.title")}>
        <p>{t("demos.feed.intro.loading")}</p>
        <p>{t("demos.feed.intro.favorites")}</p>
      </PageIntro>
      <div className="grid gap-8 lg:grid-cols-[1fr_240px]">
        {/* FeedHydration 要等缓存的快照：HTML 里先是骨架屏，第一页作为片段写在同一份 HTML 后面，由内联脚本换上，不用等应用的 JS。 */}
        <Suspense fallback={<FeedSkeleton />}>
          <FeedHydration />
        </Suspense>
        <Suspense fallback={<FavoritesPanelSkeleton />}>
          <FavoritesHydration />
        </Suspense>
      </div>
    </>
  );
}

/**
 * 收藏属于用户自己的数据，按请求读取（Demo 没有用户，按真实应用的形态演示）。服务端预取后随页面送达，
 * 在自己的 Suspense 里，不挡作品广场。
 */
async function FavoritesHydration() {
  if (!isDemoBackendEnabled()) return null;
  await connection();
  const queryClient = new QueryClient();
  // 读取失败时面板在浏览器里重新请求，并显示自己的错误状态。
  const favorites = favoriteTasksQueryOptions();
  await queryClient
    .query({
      ...favorites,
      queryFn: () => listTasks(taskFiltersOf(favorites)),
    })
    .catch(noop);
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <FavoritesPanel />
    </HydrationBoundary>
  );
}

async function FeedHydration() {
  if (!isDemoBackendEnabled()) return null;
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
