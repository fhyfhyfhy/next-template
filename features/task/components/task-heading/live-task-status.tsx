"use client";

import { useQuery } from "@/lib/react-query";

import { getTaskQueryOptions } from "../../api/get-task";
import { TaskStatusBadge } from "../task-status-badge";

/** 用 `select` 只订阅 status：轮询带回的进度变化不会让它重新渲染。 */
export function LiveTaskStatus({ taskId }: { taskId: string }) {
  const { data: status } = useQuery({
    ...getTaskQueryOptions(taskId),
    select: (task) => task.status,
  });
  if (!status) return null;
  return (
    <span data-testid="task-status">
      <TaskStatusBadge status={status} />
    </span>
  );
}
