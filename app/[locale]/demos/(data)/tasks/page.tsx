import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import {
  CreateTaskForm,
  MOCK_API_RUNNING,
  PageIntro,
  parseTaskListParams,
  TaskList,
  TaskListNavigation,
  TaskListSkeleton,
  TaskListToolbar,
  toTaskFilters,
} from "@/features/demo-task";
import { getCachedTaskPage } from "@/features/demo-task/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app.demos.tasks");
  return { title: t("metadataTitle") };
}

export default function TasksPage({
  searchParams,
}: PageProps<"/[locale]/demos/tasks">) {
  const t = useTranslations("app.demos.tasks");
  return (
    <>
      <PageIntro title={t("title")}>
        <p>{t("intro.ownership")}</p>
        <p>{t("intro.tryIt")}</p>
      </PageIntro>
      <CreateTaskForm />
      {/* The page stays synchronous and awaits searchParams only inside
          Suspense, so everything but the toolbar and the list goes into the
          static shell. */}
      <TaskListNavigation>
        <Suspense fallback={<div className="mb-4 h-8" />}>
          {searchParams.then((query) => (
            <TaskListToolbar params={parseTaskListParams(query)} />
          ))}
        </Suspense>
        <Suspense fallback={<TaskListSkeleton />}>
          {searchParams.then((query) => {
            if (!MOCK_API_RUNNING) return null;
            const params = parseTaskListParams(query);
            return (
              <TaskList
                params={params}
                tasksPromise={getCachedTaskPage(toTaskFilters(params))}
              />
            );
          })}
        </Suspense>
      </TaskListNavigation>
    </>
  );
}
