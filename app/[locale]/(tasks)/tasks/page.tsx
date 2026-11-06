import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import {
  CreateTaskForm,
  loadTaskListSearchParams,
  PageHeading,
  TaskList,
  TaskListBusy,
  TaskListNavigation,
  TaskListSkeleton,
  TaskListToolbar,
  toTaskFilters,
} from "@/features/task";
import { getCachedTaskPage } from "@/features/task/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("app.tasks.title") };
}

export default function TasksPage({
  searchParams,
}: PageProps<"/[locale]/tasks">) {
  const t = useTranslations();
  return (
    <>
      <PageHeading title={t("app.tasks.title")} className="mb-8" />
      <CreateTaskForm className="mb-8" />
      {/* page 保持同步，只在 Suspense 里读 URL：工具栏和列表以外的部分都能进静态 shell。 */}
      <TaskListNavigation>
        {/* 工具栏用 useQueryStates 读 URL，它读 useSearchParams，预渲染时没有值。 */}
        <Suspense fallback={<div className="mb-4 h-8" />}>
          <TaskListToolbar className="mb-4" />
        </Suspense>
        <TaskListBusy>
          <Suspense fallback={<TaskListSkeleton />}>
            {loadTaskListSearchParams(searchParams).then((params) => {
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
