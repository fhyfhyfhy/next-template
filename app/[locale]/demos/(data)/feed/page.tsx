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
        {/* FeedHydration waits for the cached snapshot. The HTML starts
            with the skeleton; the first page follows later in the same HTML
            as a fragment that an inline script swaps in, without waiting
            for the app's JS. */}
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
  // dehydrate() reads the current time during prerendering, so build the
  // hydration state by hand from the cached snapshot's timestamp.
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
