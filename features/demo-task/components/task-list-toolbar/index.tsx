"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/cn";
import { Link } from "@/lib/i18n/navigation";

import { TASK_STATUSES } from "../../constants/task-list";
import { taskListHref, type TaskListParams } from "../../utils/task-urls";
import { useTaskListNavigation } from "../task-list-navigation";
import { SortSelect } from "./sort-select";

const statusTabs = [undefined, ...TASK_STATUSES];

/**
 * Status filter and sort. Every choice goes into the URL, so sharing, reloading
 * and back/forward restore it, and the Server Component reads again for the new
 * URL. The new choice shows before the new list arrives; another choice
 * meanwhile builds on it.
 */
export function TaskListToolbar({ params }: { params: TaskListParams }) {
  const t = useTranslations("demo-task");
  const { selected, navigate } = useTaskListNavigation(params);
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <nav
        aria-label={t("taskListToolbar.statusFilter")}
        className="flex flex-wrap gap-1"
      >
        {statusTabs.map((status) => {
          const next = { ...selected, status, page: 1 };
          return (
            <Link
              key={status ?? "all"}
              href={taskListHref(next)}
              // onNavigate rather than onClick: a Ctrl/Cmd-click that opens a
              // new tab doesn't fire it and is left to the browser.
              onNavigate={(event) => {
                event.preventDefault();
                navigate(next);
              }}
              aria-current={selected.status === status ? "page" : undefined}
              className={cn(
                "rounded-control px-3 py-1.5 text-sm transition-colors",
                selected.status === status
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {status
                ? t(`taskStatus.${status}`)
                : t("taskListToolbar.allStatuses")}
            </Link>
          );
        })}
      </nav>
      <SortSelect selected={selected} onNavigate={navigate} />
    </div>
  );
}
