import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import {
  CreateTaskForm,
  loadTaskListSearchParams,
  PageIntro,
  TaskList,
  TaskListBusy,
  TaskListNavigation,
  TaskListSkeleton,
  TaskListToolbar,
  toTaskFilters,
} from "@/features/demo-task";
import { getCachedTaskPage } from "@/features/demo-task/server";
import { isDemoBackendEnabled } from "@/lib/demo-backend";

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
      {/* page 保持同步，只在 Suspense 里读 URL：工具栏和列表以外的部分都能进静态 shell。 */}
      <TaskListNavigation>
        {/* 工具栏用 useQueryStates 读 URL，它读 useSearchParams，预渲染时没有值。 */}
        <Suspense fallback={<div className="mb-4 h-8" />}>
          <TaskListToolbar />
        </Suspense>
        <TaskListBusy>
          <Suspense fallback={<TaskListSkeleton />}>
            {loadTaskListSearchParams(searchParams).then((params) => {
              if (!isDemoBackendEnabled()) return null;
              return (
                <TaskList
                  tasksPromise={getCachedTaskPage(toTaskFilters(params))}
                />
              );
            })}
          </Suspense>
        </TaskListBusy>
      </TaskListNavigation>
    </>
  );
}
