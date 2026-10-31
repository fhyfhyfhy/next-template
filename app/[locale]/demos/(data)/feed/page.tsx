import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
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

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app.demos.feed");
  return { title: t("metadataTitle") };
}

export default function FeedPage() {
  const t = useTranslations("app.demos.feed");
  return (
    <>
      <PageIntro title={t("title")}>
        <p>{t("intro.loading")}</p>
        <p>{t("intro.favorites")}</p>
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
