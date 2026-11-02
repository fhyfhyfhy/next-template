"use client";

import { useTranslations } from "next-intl";
import { use } from "react";

import { DateTime } from "@/components/date-time";
import { Link } from "@/lib/i18n/navigation";

import type { TaskPage } from "../../api/get-tasks";
import { DATE_TIME_FORMAT } from "../../constants/date-time";
import { useRefreshTaskListWhenActiveChanges } from "../../hooks/use-refresh-task-list-when-active-changes";
import {
  taskDetailHref,
  taskListHref,
  type TaskListParams,
} from "../../utils/task-urls";
import { TaskCover } from "../task-cover";
import { useTaskListNavigation } from "../task-list-navigation";
import { TaskStatusBadge } from "../task-status-badge";
import { FavoriteToggle } from "./favorite-toggle";

interface TaskListProps {
  /**
   * The read the Server Component passes down without awaiting. `use()` unwraps
   * it here; until it resolves, the enclosing Suspense shows the skeleton.
   */
  tasksPromise: Promise<TaskPage>;
  params: TaskListParams;
}

export function TaskList({ tasksPromise, params }: TaskListProps) {
  const t = useTranslations("demo-task.taskList");
  const { items, total, hasMore } = use(tasksPromise);
  const { pending, navigate } = useTaskListNavigation(params);
  useRefreshTaskListWhenActiveChanges(items);
  const previousPage = { ...params, page: params.page - 1 };
  const nextPage = { ...params, page: params.page + 1 };
  return (
    // During navigation this is still the old list, so mark it busy and dim it.
    <div
      aria-busy={pending}
      className="transition-opacity aria-busy:opacity-60"
    >
      {items.length === 0 ? (
        <p className="rounded-panel border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul
          aria-label={t("label")}
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
        aria-label={t("pagination")}
        className="mt-4 flex items-center justify-between text-sm"
      >
        <span className="text-muted-foreground">{t("total", { total })}</span>
        <div className="flex gap-2">
          {params.page > 1 && (
            <Link
              href={taskListHref(previousPage)}
              onNavigate={(event) => {
                event.preventDefault();
                navigate(previousPage);
              }}
              className="rounded-control border border-border px-3 py-1.5 hover:bg-accent"
            >
              {t("previousPage")}
            </Link>
          )}
          {hasMore && (
            <Link
              href={taskListHref(nextPage)}
              onNavigate={(event) => {
                event.preventDefault();
                navigate(nextPage);
              }}
              className="rounded-control border border-border px-3 py-1.5 hover:bg-accent"
            >
              {t("nextPage")}
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}
