"use client";

import Link from "next/link";

import { cn } from "@/lib/cn";

import { TASK_STATUS_LABELS, TASK_STATUSES } from "../../constants/task-list";
import {
  taskListHref,
  type TaskListParams,
} from "../../utils/task-list-params";
import { SortSelect } from "./sort-select";

const statusTabs = [
  { status: undefined, label: "全部" },
  ...TASK_STATUSES.map((status) => ({
    status,
    label: TASK_STATUS_LABELS[status],
  })),
];

/** 状态筛选和排序。每次选择都写进 URL：分享、刷新和前进后退都能还原，Server Component 按新 URL 重新读取。 */
export function TaskListToolbar({ params }: { params: TaskListParams }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="按状态筛选" className="flex flex-wrap gap-1">
        {statusTabs.map(({ status, label }) => (
          <Link
            key={label}
            href={taskListHref({ ...params, status, page: 1 })}
            aria-current={params.status === status ? "page" : undefined}
            className={cn(
              "rounded-control px-3 py-1.5 text-sm transition-colors",
              params.status === status
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
      <SortSelect params={params} />
    </div>
  );
}
