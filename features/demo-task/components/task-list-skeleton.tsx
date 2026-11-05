import { Skeleton } from "@/components/ui/skeleton";

import { TASK_LIST_PAGE_SIZE } from "../constants/task-list";

/** 全部任务列表的占位，行数和行高与加载后的列表一致，下面是总数和翻页按钮那一行。 */
export function TaskListSkeleton() {
  return (
    <div data-testid="task-list-skeleton">
      <div className="divide-y divide-border rounded-panel border border-border bg-card">
        {Array.from({ length: TASK_LIST_PAGE_SIZE }, (_, index) => (
          <div key={index} className="flex items-center gap-4 p-3">
            <Skeleton className="size-14 shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-8.5 w-20" />
      </div>
    </div>
  );
}
