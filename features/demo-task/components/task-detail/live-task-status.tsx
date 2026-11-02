"use client";

import { useQuery } from "@/lib/react-query";

import { getTaskQueryOptions } from "../../api/get-task";
import { TaskStatusBadge } from "../task-status-badge";

/**
 * Subscribes to status alone through `select`, so progress changes from polling
 * don't re-render it.
 */
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
