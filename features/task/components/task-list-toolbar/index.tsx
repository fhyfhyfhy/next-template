"use client";

import { useTranslations } from "next-intl";

import { TabsList, TabsRoot, TabsTab } from "@/components/ui/tabs";
import { cn } from "@/lib/cn";

import { TASK_STATUSES } from "../../constants/task-list";
import { TaskListLink, useTaskListSearchParams } from "../task-list-navigation";
import { SortSelect } from "./sort-select";

const statusTabs = [null, ...TASK_STATUSES];

/**
 * 状态筛选和排序。每次选择都写进 URL：分享、刷新和前进后退都能还原，Server Component 按新 URL 重新读取。
 * 新列表到达前先显示新的选择；换筛选时回到第一页。
 */
export function TaskListToolbar({ className }: { className?: string }) {
  const t = useTranslations();
  const [{ status: selected }] = useTaskListSearchParams();
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3",
        className,
      )}
    >
      <TabsRoot value={selected ?? "all"}>
        <TabsList size="sm" aria-label={t("task.taskListToolbar.statusFilter")}>
          {statusTabs.map((status) => (
            <TabsTab
              key={status ?? "all"}
              value={status ?? "all"}
              nativeButton={false}
              render={<TaskListLink values={{ status, page: null }} />}
            >
              {status
                ? t(`task.taskStatus.${status}`)
                : t("task.taskListToolbar.allStatuses")}
            </TabsTab>
          ))}
        </TabsList>
      </TabsRoot>
      <SortSelect />
    </div>
  );
}
