import type { Metadata } from "next";
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

export const metadata: Metadata = { title: "全部任务 · Data demo" };

export default function TasksPage({ searchParams }: PageProps<"/demos/tasks">) {
  return (
    <>
      <PageIntro title="全部任务">
        <p>
          列表由 Server Component 负责：筛选、排序、分页都写在 URL
          里，每次选择都是一次导航，服务端按新的 URL
          重新读取。读取结果进了服务端缓存，列表只是一个短时间内的快照；创建、收藏这类你自己的写入会让缓存立即失效。任务状态会自己推进：有进行中的任务时，页面每
          3 秒检查一次，有变化就重新读取列表。
        </p>
        <p>
          试试：切换状态和排序后按浏览器后退；创建一个任务，停在这一页看它推进到已完成；创建一个已存在名称的任务；收藏一个任务。
        </p>
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
