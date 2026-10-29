"use client";

import { useQuery } from "@/lib/react-query";

import { getTaskQueryOptions } from "../api/get-task";
import { getTasksQueryOptions } from "../api/get-tasks";
import { TaskLinkRow } from "./task-link-row";

/**
 * 依赖查询：先从详情 query 里取 prompt，再用它查其他任务；prompt 还没拿到时第二个请求不发。
 * 只在浏览器里请求，不在服务端预取。
 */
export function RelatedTasks({ taskId }: { taskId: string }) {
  const { data: prompt } = useQuery({
    ...getTaskQueryOptions(taskId),
    select: (task) => task.prompt,
  });
  const related = useQuery({
    ...getTasksQueryOptions({ prompt, excludeId: taskId, pageSize: 5 }),
    enabled: prompt !== undefined,
  });
  return (
    <section>
      <h2 className="mb-2 text-sm font-medium">同 prompt 的其他任务</h2>
      {related.data ? (
        related.data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">没有其他任务</p>
        ) : (
          <ul aria-label="同 prompt 的其他任务" className="space-y-2">
            {related.data.items.map((item) => (
              <li key={item.id}>
                <TaskLinkRow
                  taskId={item.id}
                  name={item.name}
                  status={item.status}
                />
              </li>
            ))}
          </ul>
        )
      ) : related.error ? (
        <p className="text-sm text-destructive">加载失败</p>
      ) : (
        <p className="text-sm text-muted-foreground">加载中…</p>
      )}
    </section>
  );
}
