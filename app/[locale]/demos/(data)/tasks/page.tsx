import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import {
  CreateTaskForm,
  PageIntro,
  parseTaskListParams,
  TaskList,
  TaskListNavigation,
  TaskListSkeleton,
  TaskListToolbar,
  toTaskFilters,
} from "@/features/demo-task";
import {
  getCachedTaskPage,
  isDemoBackendEnabled,
} from "@/features/demo-task/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return { title: t("demos.tasks.metadataTitle") };
}

export default function TasksPage({
  searchParams,
}: PageProps<"/[locale]/demos/tasks">) {
  const t = useTranslations("app");
  return (
    <>
      <PageIntro title={t("demos.tasks.title")}>
        <p>{t("demos.tasks.intro.ownership")}</p>
        <p>{t("demos.tasks.intro.tryIt")}</p>
      </PageIntro>
      <CreateTaskForm />
      {/* page 保持同步，只在 Suspense 里等 searchParams：工具栏和列表以外的部分都能进静态 shell。 */}
      <TaskListNavigation>
        <Suspense fallback={<div className="mb-4 h-8" />}>
          {searchParams.then((query) => (
            <TaskListToolbar params={parseTaskListParams(query)} />
          ))}
        </Suspense>
        <Suspense fallback={<TaskListSkeleton />}>
          {searchParams.then((query) => {
            if (!isDemoBackendEnabled()) return null;
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
