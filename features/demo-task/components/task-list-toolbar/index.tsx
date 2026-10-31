"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/cn";
import { Link } from "@/lib/i18n-navigation";

import { TASK_STATUSES } from "../../constants/task-list";
import { taskListHref, type TaskListParams } from "../../utils/task-urls";
import { useTaskListNavigation } from "../task-list-navigation";
import { SortSelect } from "./sort-select";

const statusTabs = [undefined, ...TASK_STATUSES];

/**
 * 状态筛选和排序。每次选择都写进 URL：分享、刷新和前进后退都能还原，Server Component 按新 URL 重新读取。
 * 新列表到达前先显示新的选择；这期间再选，在这次选择的基础上继续改。
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
              // 用 onNavigate 而不是 onClick：Ctrl/Cmd 点击在新标签页打开时不触发它，交给浏览器处理。
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
