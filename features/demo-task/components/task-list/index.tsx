"use client";

import Link from "next/link";
import { use } from "react";

import type { TaskPage } from "../../api/get-tasks";
import { formatDateTime } from "../../utils/format-date-time";
import {
  taskListHref,
  type TaskListParams,
} from "../../utils/task-list-params";
import { TaskCover } from "../task-cover";
import { TaskStatusBadge } from "../task-status-badge";
import { FavoriteToggle } from "./favorite-toggle";

interface TaskListProps {
  /** Server Component 不 await 直接传下来的读取结果，这里用 `use()` 取值，未完成时由外层 Suspense 显示骨架屏。 */
  tasksPromise: Promise<TaskPage>;
  params: TaskListParams;
}

export function TaskList({ tasksPromise, params }: TaskListProps) {
  const { items, total, hasMore } = use(tasksPromise);
  return (
    <div>
      {items.length === 0 ? (
        <p className="rounded-panel border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          没有符合条件的任务
        </p>
      ) : (
        <ul
          aria-label="任务列表"
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
                  href={`/demos/tasks/${task.id}`}
                  className="block truncate font-medium outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {task.name}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDateTime(task.createdAt)}
                </p>
              </div>
              <TaskStatusBadge status={task.status} />
              <FavoriteToggle taskId={task.id} favorite={task.favorite} />
            </li>
          ))}
        </ul>
      )}
      <nav
        aria-label="分页"
        className="mt-4 flex items-center justify-between text-sm"
      >
        <span className="text-muted-foreground">共 {total} 个任务</span>
        <div className="flex gap-2">
          {params.page > 1 && (
            <Link
              href={taskListHref({ ...params, page: params.page - 1 })}
              className="rounded-control border border-border px-3 py-1.5 hover:bg-accent"
            >
              上一页
            </Link>
          )}
          {hasMore && (
            <Link
              href={taskListHref({ ...params, page: params.page + 1 })}
              className="rounded-control border border-border px-3 py-1.5 hover:bg-accent"
            >
              下一页
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}
