"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useQueries } from "@/lib/react-query";

import { getTaskQueryOptions, isTaskNotFound } from "../api/get-task";
import { useRecentTaskIds } from "../hooks/use-recent-task-ids";
import { TaskLinkRow } from "./task-link-row";

/**
 * 请求的输入来自 localStorage，只有浏览器能读：服务端和 hydration 首轮 `ids` 为 null，这时不发请求，
 * 读到 id 之后每个任务一个 query，复用详情页的工厂和缓存。
 */
export function RecentTasks() {
  const { ids } = useRecentTaskIds();
  const tasks = useQueries({
    queries: (ids ?? []).map((id) => getTaskQueryOptions(id)),
  });
  if (ids === null) {
    return <p className="text-sm text-muted-foreground">读取浏览记录…</p>;
  }
  if (ids.length === 0) {
    return <p className="text-sm text-muted-foreground">还没有查看过任务</p>;
  }
  return (
    <ul
      aria-label="最近查看"
      className="max-w-2xl divide-y divide-border rounded-panel border border-border bg-card"
    >
      {ids.map((id, index) => {
        const { data, error } = tasks[index];
        return (
          <li key={id} className="p-3 text-sm">
            {data ? (
              <TaskLinkRow task={data} />
            ) : isTaskNotFound(error) ? (
              <span className="text-muted-foreground">
                任务已被删除（{id}）
              </span>
            ) : error ? (
              <span className="text-destructive">加载失败（{id}）</span>
            ) : (
              <Skeleton className="h-4 w-40" />
            )}
          </li>
        );
      })}
    </ul>
  );
}
