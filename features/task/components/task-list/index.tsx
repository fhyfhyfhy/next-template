"use client";

import { useMounted } from "@mantine/hooks";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { use } from "react";

import { DateTime } from "@/components/date-time";

import type { TaskPage } from "../../api/get-tasks";
import { DATE_TIME_FORMAT } from "../../constants/date-time";
import { taskDetailHref, toTaskFilters } from "../../utils/task-urls";
import { TaskCover } from "../task-cover";
import { TaskListLink, useTaskListSearchParams } from "../task-list-navigation";
import { TaskStatusBadge } from "../task-status-badge";
import { TaskListChangeSignal } from "./change-signal";
import { FavoriteToggle } from "./favorite-toggle";

export { TaskListSkeleton } from "./skeleton";

interface TaskListProps {
  /** Server Component 不 await 直接传下来的读取结果，这里用 `use()` 取值，未完成时由外层 Suspense 显示骨架屏。 */
  tasksPromise: Promise<TaskPage>;
}

export function TaskList({ tasksPromise }: TaskListProps) {
  const t = useTranslations();
  const { items, total } = use(tasksPromise);
  const [searchParams] = useTaskListSearchParams();
  // 翻页从当前选择的页码出发，而不是这次渲染的列表：导航进行中再点，渲染的还是旧页。页码按服务端读取列表时的
  // 规则换算；有没有下一页也按这个页码和总数算，旧页的 `hasMore` 对应的是旧页码。
  const { page, pageSize } = toTaskFilters(searchParams);
  const hasNextPage = page * pageSize < total;
  const mounted = useMounted();
  return (
    <>
      {mounted && <TaskListChangeSignal items={items} />}
      {items.length === 0 ? (
        <p className="rounded-panel border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {t("task.taskList.empty")}
        </p>
      ) : (
        <ul
          aria-label={t("task.taskList.label")}
          className="divide-y divide-border rounded-panel border border-border bg-card"
        >
          {items.map((task) => (
            <li key={task.id} className="flex items-center gap-4 p-3">
              <TaskCover
                coverUrl={task.coverUrl}
                className="size-14 shrink-0 rounded-control"
              />
              <div className="min-w-0 flex-1">
                <Link
                  href={taskDetailHref(task.id)}
                  className="block truncate font-medium outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {task.name}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  <DateTime value={task.createdAt} format={DATE_TIME_FORMAT} />
                </p>
              </div>
              <TaskStatusBadge status={task.status} />
              <FavoriteToggle task={task} />
            </li>
          ))}
        </ul>
      )}
      <nav
        aria-label={t("task.taskList.pagination")}
        className="mt-4 flex items-center justify-between text-sm"
      >
        <span className="text-muted-foreground">
          {t("task.taskList.total", { total })}
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <TaskListLink
              values={{ page: page - 1 }}
              className="rounded-control border border-border px-3 py-1.5 hover:bg-accent"
            >
              {t("task.taskList.previousPage")}
            </TaskListLink>
          )}
          {hasNextPage && (
            <TaskListLink
              values={{ page: page + 1 }}
              className="rounded-control border border-border px-3 py-1.5 hover:bg-accent"
            >
              {t("task.taskList.nextPage")}
            </TaskListLink>
          )}
        </div>
      </nav>
    </>
  );
}
