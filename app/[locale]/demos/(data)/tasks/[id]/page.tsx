import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import {
  DemoNote,
  getCommentsQueryOptions,
  getTaskQueryOptions,
  isTaskNotFound,
  MOCK_API_RUNNING,
  TaskDetail,
  TaskDetailSkeleton,
} from "@/features/demo-task";
import { getTask, omitFunctionMeta } from "@/features/demo-task/server";
import {
  defaultShouldDehydrateQuery,
  dehydrate,
  HydrationBoundary,
  noop,
  QueryClient,
} from "@/lib/react-query";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/demos/tasks/[id]">): Promise<Metadata> {
  const t = await getTranslations("app.demos.taskDetail");
  if (!MOCK_API_RUNNING) return { title: t("mockApiOffTitle") };
  const { id } = await params;
  // The same GET as the page's prefetch, so one render requests it once
  // (fetchApi dedupes when no signal is passed).
  const task = await getTask(id).catch((error: unknown) => {
    if (isTaskNotFound(error)) return null;
    throw error;
  });
  return {
    title: t("metadataTitle", { name: task?.name ?? t("notFound.title") }),
  };
}

// The page stays synchronous and reads params only inside Suspense, so the
// skeleton goes into the static shell and shows at once on navigation. The
// cost: a missing task gets no 404 status. The shell has already gone out with
// 200, and notFound() then streams the not-found page and adds noindex.
export default function TaskDetailPage({
  params,
}: PageProps<"/[locale]/demos/tasks/[id]">) {
  const t = useTranslations("app.demos.taskDetail.note");
  return (
    <>
      <DemoNote>
        <p>{t("ownership")}</p>
        <p>{t("tryIt")}</p>
      </DemoNote>
      <Suspense fallback={<TaskDetailSkeleton />}>
        {params.then(({ id }) => (
          <TaskDetailHydration id={id} />
        ))}
      </Suspense>
    </>
  );
}

async function TaskDetailHydration({ id }: { id: string }) {
  if (!MOCK_API_RUNNING) return null;
  const queryClient = new QueryClient();
  try {
    await queryClient.query(getTaskQueryOptions(id));
  } catch (error) {
    if (isTaskNotFound(error)) notFound();
    throw error;
  }
  // Comments don't hold up the first paint: not awaited, dehydrated as pending,
  // and streamed to the browser when the data arrives.
  void queryClient.query(getCommentsQueryOptions(id)).catch(noop);
  const state = dehydrate(queryClient, {
    shouldDehydrateQuery: (query) =>
      defaultShouldDehydrateQuery(query) || query.state.status === "pending",
  });
  return (
    <HydrationBoundary state={omitFunctionMeta(state)}>
      <TaskDetail taskId={id} />
    </HydrationBoundary>
  );
}
