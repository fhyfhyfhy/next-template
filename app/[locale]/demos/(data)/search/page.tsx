import type { Metadata } from "next";
import { connection } from "next/server";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import {
  loadTaskSearchSearchParams,
  PageIntro,
  searchTasksQueryOptions,
  TaskSearch,
  TaskSearchSkeleton,
} from "@/features/demo-task";
import { isDemoBackendEnabled, searchTasks } from "@/features/demo-task/server";
import {
  defaultShouldDehydrateQuery,
  dehydrate,
  HydrationBoundary,
  noop,
  QueryClient,
} from "@/lib/react-query";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return { title: t("demos.search.metadataTitle") };
}

export default function SearchPage({
  searchParams,
}: PageProps<"/[locale]/demos/search">) {
  const t = useTranslations("app");
  return (
    <>
      <PageIntro title={t("demos.search.title")}>
        <p>{t("demos.search.intro.typing")}</p>
        <p>{t("demos.search.intro.tryIt")}</p>
      </PageIntro>
      {/* 关键词在 URL 里，预渲染时没有值：搜索框和结果在请求时渲染，页面其他部分进静态 shell。 */}
      <Suspense fallback={<TaskSearchSkeleton />}>
        {loadTaskSearchSearchParams(searchParams).then(({ q }) => (
          <TaskSearchHydration term={q.trim()} />
        ))}
      </Suspense>
    </>
  );
}

/**
 * 带关键词打开或刷新页面时，服务端按 URL 里的关键词预取结果，不 await：搜索框先渲染，结果以 pending 状态流式送达。
 * 搜索按请求读取：关键词的组合没有上限，缓存几乎命中不了。
 */
async function TaskSearchHydration({ term }: { term: string }) {
  if (!term || !isDemoBackendEnabled()) return <TaskSearch />;
  await connection();
  const queryClient = new QueryClient();
  void queryClient
    .query({
      ...searchTasksQueryOptions(term),
      queryFn: () => searchTasks(term),
    })
    .catch(noop);
  const state = dehydrate(queryClient, {
    shouldDehydrateQuery: (query) =>
      defaultShouldDehydrateQuery(query) || query.state.status === "pending",
  });
  return (
    <HydrationBoundary state={state}>
      <TaskSearch />
    </HydrationBoundary>
  );
}
