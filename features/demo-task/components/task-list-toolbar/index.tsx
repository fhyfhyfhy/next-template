"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/cn";

import { TASK_STATUSES } from "../../constants/task-list";
import { TaskListLink, useTaskListSearchParams } from "../task-list-navigation";
import { SortSelect } from "./sort-select";

const statusTabs = [null, ...TASK_STATUSES];

/**
 * 状态筛选和排序。每次选择都写进 URL：分享、刷新和前进后退都能还原，Server Component 按新 URL 重新读取。
 * 新列表到达前先显示新的选择；换筛选时回到第一页。
 */
export function TaskListToolbar() {
  const t = useTranslations("demo-task");
  const [{ status: selected }] = useTaskListSearchParams();
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <nav
        aria-label={t("taskListToolbar.statusFilter")}
        className="flex flex-wrap gap-1"
      >
        {statusTabs.map((status) => (
          <TaskListLink
            key={status ?? "all"}
            values={{ status, page: null }}
            aria-current={selected === status ? "page" : undefined}
            className={cn(
              "rounded-control px-3 py-1.5 text-sm transition-colors",
              selected === status
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {status
              ? t(`taskStatus.${status}`)
              : t("taskListToolbar.allStatuses")}
          </TaskListLink>
        ))}
      </nav>
      <SortSelect />
    </div>
  );
}
